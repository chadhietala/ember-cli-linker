'use strict';

var AllDependencies         = require('./all-dependencies');
var syncForwardDependencies = require('./sync-forward-dependencies');
var utils                   = require('./utils');
var CoreObject              = require('core-object');
var RSVP                    = require('rsvp');
var walkSync                = require('walk-sync');
var path                    = require('path');
var fs                      = require('fs-extra');
var generateNodeInfo        = require('./nodes/node');
var mapSeries               = require('promise-map-series');
var uniq                    = utils.uniq;
var flatMap                 = utils.flatMap;
var isEntryFiles            = utils.isEntryFiles;
var getImportInfo           = utils.getImportInfo;

module.exports = CoreObject.extend({
  init: function(inputTrees, options) {
    var defaultResolvers = ['addon', 'npm', 'es'];
    this.resolvers = {};
    this.inputTrees = inputTrees;
    this.options = options || {};
    this.importCache = null;
    this.description = 'Ember CLI Pre-Packager';

    if (!this.options.entries) {
      throw new Error('You must pass an array of entries.');
    }

    if (options.resolutionTypes) {
      this.resolutionTypes = options.resolutionTypes.concat(defaultResolvers);
    } else {
      this.resolutionTypes = defaultResolvers;
    }

    this.resolutionTypes.forEach(function(type) {
      this.resolvers[type] = require('./resolvers/' + type);
    }, this);

    this.entries = options.entries;
  },

  parsedTrees: {},

  parseTree: function(relativePaths, inputPath) {
    var pkgName;

    if (relativePaths.length > 0) {
      pkgName = getImportInfo(relativePaths[0]).pkgName;
    }
    
    if (this._shouldResolveTree(pkgName, relativePaths)) {
      this.parsedTrees[pkgName] = {
        inputPath: inputPath,
        relativePaths: relativePaths
      };
    } else {
      this.syncForwardAssets(relativePaths, inputPath);
    }
  },

  rebuild: function() {
    this.inputPaths.forEach(function(fullPath) {
      this.parseTree(walkSync(fullPath), fullPath);
    }, this);

    return this.resolveEntries();
  },

  /**
   * Syncs forward all assets that cannot be resolved via dep-graph.json
   * @param  {String} relativePaths The list of relative paths to sync
   * @param  {String} inputPath     The source directory
   */
  syncForwardAssets: function(relativePaths, inputPath) {
    relativePaths.filter(function(relativePath) {
      return relativePath.slice(-1) !== '/';
    }).forEach(function(relativePath) {
      var source = inputPath + '/' + relativePath;
      var destination = this.outputPath + '/' + relativePath; 
      syncForwardDependencies(destination, source);
    }, this);
  },

  _shouldResolveTree: function (pkgName, relativePaths) {
    if (pkgName === '__packager__') {
      return false;
    }

    return relativePaths.indexOf(pkgName + '/dep-graph.json') > -1;
  },

  _shouldAddTests: function(entry) {
    var tests = entry + '-tests';
    var hasTests = this.parsedTrees[tests];

    if (hasTests) {
      AllDependencies.update(tests,
        fs.readJSONSync(hasTests.inputPath + '/' + tests + '/dep-graph.json')
      );
      AllDependencies.mergeImports(entry, tests);
    }
    
    return hasTests;
  },

  shouldAddEntryTests: function(entry, relativePaths) {
    var entryTests = this._shouldAddTests(entry);

    if (entryTests) {
      return relativePaths.concat(entryTests.relativePaths);
    }

    return relativePaths;
  },

  syncForwardEntry: function(entry, relativePaths) {
    var srcDir = this.parsedTrees[entry].inputPath;

    relativePaths = this.shouldAddEntryTests(entry, relativePaths);

    relativePaths.filter(isEntryFiles(entry)).forEach(function(relativePath) {
      var destination = path.join(this.outputPath, relativePath);
      var shouldAddTests = this._shouldAddTests(entry);
      var test = shouldAddTests;
      var source;
      
      if (shouldAddTests && relativePath.indexOf('-tests') > -1) {
        source = path.join(test.inputPath, relativePath);
      } else {
        source = path.join(srcDir, relativePath);
      }

      syncForwardDependencies(destination, source);
    }, this);
  },

  /**
   * Syncs all of the entries' files and then
   * begins the resolution and materialization
   * of the graph.
   * @param  {String} srcDir  The source directory of the files
   * @param  {String} destDir The destination temp directory
   * @return {Promise}
   */
  resolveEntries: function() {
    this.importCache = {};

    return RSVP.Promise.all(this.entries.map(function(entry) {
      var dep = this.parsedTrees[entry];      
      var graphPath = path.join(dep.inputPath, entry, 'dep-graph.json');
      var entryDepGraph = fs.readJSONSync(graphPath);

      AllDependencies.update(entry, entryDepGraph);
      
      this.syncForwardEntry(entry, dep.relativePaths);

      return this.selectResolution(entry, this.generatePkgInfo(entry));
    }, this)).then(function () {
      return RSVP.Promise.all(Object.keys(this.resolvers).map(function(resolver) {
        var resolveLater = this.resolvers[resolver].resolveLater;
        var importCache = this.importCache[resolver];

        if (resolveLater && importCache) {
          return resolveLater.call(this.resolvers[resolver], this.outputPath, importCache);
        }
      }, this));
    }.bind(this));
  },

  /**
   * This is only called for an entry e.g. an app or engine.
   * Since an entry is the entry node in the graph you can safely
   * just get the unique dependencies in the entry.
   * @param  {String} entry     A top level node
   * @param  {String} graphPath The path to dep-graph.json
   * @return {Array}            The direct dependencies for the entry
   */
  generatePkgInfo: function(entry) {
    var pkgInfo = {};

    var imports = uniq(flatMap(Object.keys(AllDependencies.for(entry)), function(file) {
      var importInfos = AllDependencies.for(file);
      return importInfos.imports;
    }));

    generateNodeInfo(entry, imports, pkgInfo);

    return pkgInfo;
  },

  cacheImport: function(childInfo, parentInfo) {
    var type = this.importCache[childInfo.type];
    var pkgName = parentInfo.pkgName;
    var childName = childInfo.name;
    var importRelationship = {
      parent: pkgName,
      imports: [childName],
      parentPath: parentInfo.pkgPath,
      nodeModulesPath: path.join(parentInfo.pkgPath, 'node_modules')
    };

    if (!type) {
      type = this.importCache[childInfo.type] = {};
    }

    if (!type[pkgName]) {
      type[pkgName] = importRelationship;
    } else if (type[pkgName].imports.indexOf(childName) < 0){
      type[pkgName].imports.push(childName);
    }
  },

  /**
   * Selects the resolver based on the import type.
   * @param  {String} srcDir  The directory holding all of the soruce files
   * @param  {[type]} destDir The destination for the resolved graph
   * @param  {Array} imports An array of all the imports
   * @return {Promise}
   */
  selectResolution: function(entry, pkgInfo) {
    var imports = pkgInfo.imports;

    return mapSeries(uniq(imports), function(imprt) {
      var importInfo = getImportInfo(imprt, entry);
      var type = importInfo.type;
      var resolve = this.resolvers[type].resolve;

      if (this.resolutionTypes.indexOf(importInfo.type) < 0) {
        throw new Error('You do not have a resolver for ' + importInfo.type + ' types.');
      }

      this.cacheImport(importInfo, pkgInfo);

      if (resolve) {
        return resolve.call(this.resolvers[type], this.outputPath, importInfo, this, pkgInfo);
      } else if (this.resolvers[type].resolveLater) { 
        return this.outputPath;
      } else {
        throw new Error('No `resolve` or `resolveLater` method on the dependency resolver.');
      }
    }, this);
  }
});