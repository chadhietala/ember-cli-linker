'use strict';

var AllDependencies         = require('./all-dependencies');
var syncForwardDependencies = require('./sync-forward-dependencies');
var utils                   = require('./utils');
var uniq                    = utils.uniq;
var flatMap                 = utils.flatMap;
var isEntryFiles            = utils.isEntryFiles;
var getImportInfo           = utils.getImportInfo;
var CoreObject              = require('core-object');
var RSVP                    = require('rsvp');
var walkSync                = require('walk-sync');
var path                    = require('path');
var quickTemp               = require('quick-temp');
var fs                      = require('fs-extra');
var mapSeries               = require('promise-map-series');

module.exports = CoreObject.extend({
  init: function(inputTree, options) {
    var defaultResolvers = ['addon', 'npm'];
    this.resolvers = {};
    this.inputTree = inputTree;
    this.options = options || {};
    this.importCache = null;

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

  read: function(readTree) {
    quickTemp.makeOrRemake(this, 'tmpDestDir');
    return RSVP.Promise.resolve(this.write(readTree, this.tmpDestDir)).then(function() {
      return this.tmpDestDir;
    }.bind(this));
  },

  write: function(readTree, destDir) {
    var self = this;
    return readTree(this.inputTree).then(function(srcDir) {
      return self.resolveEntries(srcDir, destDir);
    });
  },

  updateGraph: function(name, graph) {
    AllDependencies.update(name, graph);
  },
  
  syncForwardEntry: function(srcDir, destDir, entry) {
    var paths = walkSync(srcDir);

    paths.filter(isEntryFiles(entry)).forEach(function(relativePath) {
      var destination = path.join(destDir, relativePath);
      var source = path.join(srcDir, relativePath);
      syncForwardDependencies(destination, source);
    });
  },

  resolveLater: function(srcDir, destDir) {
    return RSVP.Promise.all(Object.keys(this.resolvers).map(function(resolver) {
      var resolveLater = this.resolvers[resolver].resolveLater;
      var importCache = this.importCache[resolver];

      if (resolveLater && importCache) {
        return resolveLater.call(this.resolvers[resolver], srcDir, destDir, importCache);
      }

    }, this));
  },

  initImportCache: function() {
    this.importCache = {};
  },

  /**
   * Syncs alll of the entries' files and then
   * begins the resolution and materialization
   * of the graph.
   * @param  {String} srcDir  The source directory of the files
   * @param  {String} destDir The destination temp directory
   * @return {Promise}
   */
  resolveEntries: function(srcDir, destDir) {
    this.initImportCache();
    
    return RSVP.Promise.all(this.entries.map(function(entry) {
      var entryDepGraph = fs.readJSONSync(path.join(srcDir, entry, 'dep-graph.json'));
      this.updateGraph(entry, entryDepGraph);
      this.syncForwardEntry(srcDir, destDir, entry);
      return this.selectResolution(srcDir, destDir, this.flattenEntryImports(entry, entryDepGraph));
    }, this)).then(function () {
      return this.resolveLater(srcDir, destDir);
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
  flattenEntryImports: function(entry) {
    var pkgInfo = {};

    var imports = uniq(flatMap(Object.keys(AllDependencies.for(entry)), function(file) {
      var importInfos = AllDependencies.for(file);
      pkgInfo.pkgPath = importInfos.pkgPath;
      pkgInfo.pkg = importInfos.pkg;
      return importInfos.imports;
    }));

    pkgInfo.imports = imports;
    pkgInfo.entry = entry;
    return pkgInfo;
  },

  /**
   * Selects the resolver based on the import type.
   * @param  {String} srcDir  The directory holding all of the soruce files
   * @param  {[type]} destDir The destination for the resolved graph
   * @param  {Array} imports An array of all the imports
   * @return {Promise}
   */
  selectResolution: function(srcDir, destDir, pkgInfo) {
    var pkgPath = pkgInfo.pkgPath;
    var imports = pkgInfo.imports;

    return mapSeries(uniq(imports), function(imprt) {
      var importInfo = getImportInfo(imprt);
      if (this.resolutionTypes.indexOf(importInfo.type) < 0) {
        throw new Error('You do not have a resolver for ' + importInfo.type + ' types.');
      }

      var type = this.importCache[importInfo.type];

      if (!type) {
        type = this.importCache[importInfo.type] = {};
      }

      if (!type[pkgPath]) {
        type[pkgPath] = [imprt];
      } else {
        type[pkgPath].push(imprt);
      }

      if (this.resolvers[importInfo.type].resolve) {
        return this.resolvers[importInfo.type].resolve(
          srcDir, destDir, importInfo.id, this, pkgInfo
        );
      } else if (this.resolvers[importInfo.type].resolveLater) { 
        return destDir;
      } else {
        throw new Error('No `resolve` or `resolveLater` method on the dependency resolver.');
      }
    }, this);
  },

  cleanup: function() {
    fs.removeSync(this.tmpDestDir);
  }
});
