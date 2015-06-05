'use strict';

var AllDependencies         = require('./all-dependencies');
var syncForwardDependencies = require('./utils/sync-forward-dependencies');
var array                   = require('./utils/array');
var CoreObject              = require('core-object');
var RSVP                    = require('rsvp');
var walkSync                = require('walk-sync');
var path                    = require('path');
var fs                      = require('fs-extra');
var mapSeries               = require('promise-map-series');
var getImportInfo           = require('./utils/get-import-info');
var helpers                 = require('broccoli-kitchen-sink-helpers');
var symlinkOrCopySync       = require('symlink-or-copy').sync;
var zip                     = array.zip;
var uniq                    = array.uniq;

module.exports = CoreObject.extend({
  init: function(inputTrees, options) {
    var defaultResolvers = ['ember-app', 'npm', 'es'];
    this.resolvers = {};
    this.treeDescriptors = options.treeDescriptors;
    this.inputTrees = inputTrees;
    this.options = options || {};
    this.importCache = null;
    this.description = 'Ember CLI Pre-Packager';
    this.trees = {};
    this.graphHashes = {};

    if (!this.options.entries) {
      throw new Error('You must pass an array of entries.');
    }

    if (!this.treeDescriptors) {
      throw new Error('You must pass TreeDescriptors that describe the trees in the project.');
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

  _treeNames: function() {
    return this.inputTrees.map(function(tree) {
      return tree.name;
    });
  },

  _eligibleTrees: function() {
    return zip(this._treeNames(), this.inputPaths).filter(function(treeNameAndPath) {
      var name = treeNameAndPath[0];
      var srcDir = treeNameAndPath[1];
      return name && srcDir;
    });
  },

  decorateTreeDescriptors: function() {
    this._eligibleTrees().forEach(function(treeNameAndPath) {
      var name = treeNameAndPath[0];
      var srcDir = treeNameAndPath[1];
      var treeDescriptor = this.treeDescriptors[name];
      treeDescriptor.srcDir = srcDir;
      treeDescriptor.relativePaths = walkSync(srcDir);
    }, this);
  },

  hashGraphs: function() {
    var graphHashes = {};

    this._eligibleTrees().forEach(function(treeNameAndPath) {
      var name = treeNameAndPath[0];
      var srcDir = treeNameAndPath[1];
      var depGraphPath = path.join(srcDir, name, 'dep-graph.json');

      if (fs.existsSync(depGraphPath)) {
        graphHashes[name] = helpers.hashStrings([fs.readFileSync(depGraphPath)]);
      }
    });

    return graphHashes;
  },

  _diffGraphs: function() {
    var existingHashes = this.graphHashes;
    var existing = Object.keys(this.graphHashes);
    var incomingHashes = this.hashGraphs();
    var incoming = Object.keys(incomingHashes);
    var diff = [];

    var unstable = existing.filter(function(name) {
      var item = existingHashes[name];
      return incomingHashes[name] !== item;
    }, this).map(function(name) {
      return name;
    });

    if (unstable.length === 0) {
      return unstable;
    }

    var addition = incoming.filter(function(name) {
      return existing.indexOf(name) < 0;
    });

    diff = uniq(diff.concat(addition, unstable));

    return diff;
  },

  diffGraph: function() {
    var graphHashes = Object.keys(this.graphHashes);
    var diff;

    if (graphHashes.length === 0) {
      this.graphHashes = this.hashGraphs();
      return Object.keys(this.graphHashes);
    } else {
      diff = this._diffGraphs();

      if (diff.length > 0) {
        return diff;
      } else {
        return [];
      }
    }
  },

  syncForwardAll: function() {
    var syncedItems = AllDependencies.getSynced();
    var outputPath = this.outputPath;

    Object.keys(syncedItems).forEach(function(name) {
      var srcBase = AllDependencies.for(name).descriptor.srcDir;
      syncedItems[name].forEach(function(file) {
        var srcPath = srcBase + path.sep + file;
        var destPath = outputPath + path.sep + file;
        fs.mkdirsSync(path.dirname(destPath));
        symlinkOrCopySync(srcPath, destPath);
      });
    });
  },

  rebuild: function() {
    this.decorateTreeDescriptors();
    this.syncForwardNonGraphAssets();
    var diff = this.diffGraph();

    if (diff.length > 0) {
      return this.resolveEntries();
    } else {
      return this.syncForwardAll();
    }

  },

  _filterOutDiretory: function(relativePath) {
    return relativePath.slice(-1) !== '/';
  },

  /**
   * Syncs forward all assets that cannot be resolved via dep-graph.json
   * @param  {String} relativePaths The list of relative paths to sync
   * @param  {String} inputPath     The source directory
   */
  syncForwardNonGraphAssets: function() {
    var self = this;
    // TODO
    // Having this here sucks because are now bleeding details about
    // the input to the pre-packager.
    var whitelist = ['__packager__', 'loader.js', 'ember-cli-shims'];
    zip(this.inputTrees, this.inputPaths).filter(function(treeAndPath) {
      var tree = treeAndPath[0];
      var name = tree.name;
      return (!name || whitelist.indexOf(name) > -1);
    }).map(function(treeAndPath) {
      return [treeAndPath[1], walkSync(treeAndPath[1])];
    }).forEach(function (treeAndPath) {
      var srcDir = treeAndPath[0];
      var relativePaths = treeAndPath[1];

      relativePaths.filter(self._filterOutDiretory).forEach(function (relativePath) {
        var source = srcDir + '/' + relativePath;
        var destination = self.outputPath + '/' + relativePath;
        syncForwardDependencies('__non_js_asset__', destination, source, relativePath, true);
      });
    });
  },

  syncForwardEntry: function(entry, relativePaths) {
    var srcDir = this.treeDescriptors[entry].srcDir;

    relativePaths.filter(function(relativePath) {
      return relativePath.slice(-1) !== '/';
    }).forEach(function(relativePath) {
      var destination = path.join(this.outputPath, relativePath);
      var source = path.join(srcDir, relativePath);

      syncForwardDependencies(entry, destination, source, relativePath);
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
      var desc = this.treeDescriptors[entry];
      var name = desc.name;
      var graphPath = path.join(desc.srcDir, name, 'dep-graph.json');
      var entryDepGraph = fs.readJSONSync(graphPath);

      AllDependencies.update(desc, entryDepGraph);
      
      this.syncForwardEntry(name, desc.relativePaths);
      return this.selectResolution(name, AllDependencies.for(name).dedupedImports);
    }, this)).then(function () {
      return RSVP.Promise.all(Object.keys(this.resolvers).map(function(resolver) {
        var resolveLater = this.resolvers[resolver].resolveLater;
        var importCache = this.importCache[resolver];

        if (resolveLater && importCache) {
          return resolveLater.call(this.resolvers[resolver], this.outputPath, importCache);
        }

        return RSVP.Promise.resolve();
      }, this));
    }.bind(this));
  },

  _containsImport: function(importInfo) {
    return Object.keys(this.importCache[importInfo.type]).some(function(packageName) {
      return this.importCache[importInfo.type][packageName].imports.some(function(info) {
        return info.name === importInfo.name;
      });
    }, this);
  },

  cacheImport: function(importInfo, importer) {
    if (!this.importCache[importInfo.type]) {
      this.importCache[importInfo.type] = {};
      this.importCache[importInfo.type][importInfo.pkgName] = {
        imports: [importInfo],
        parent: AllDependencies.for(importer)
      };
    } else if (!this.importCache[importInfo.type][importInfo.pkgName]) {
      this.importCache[importInfo.type][importInfo.pkgName] = {
        imports: [importInfo],
        parent: AllDependencies.for(importer)
      };
    } else if (!this._containsImport(importInfo)) {
      this.importCache[importInfo.type][importInfo.pkgName].imports.push(importInfo);
    }
  },

  _getPackageName: function(imprt, entry) {
    var importParts = imprt.split('/');

    if (imprt.indexOf('/tests') < 0) {
      return importParts[0];
    } else {
      return entry;
    }
  },

  /**
   * Selects the resolver based on the import type.
   * @param  {String} srcDir  The directory holding all of the soruce files
   * @param  {[type]} destDir The destination for the resolved graph
   * @param  {Array} imports An array of all the imports
   * @return {Promise}
   */
  selectResolution: function(importer, imports) {
    return mapSeries(imports, function(importee) {
      var packageName = this._getPackageName(importee, importer);
      var importInfo = getImportInfo(this.treeDescriptors, packageName, importee, importer);
      var type = importInfo.type;
      var resolve;

      if (this.resolutionTypes.indexOf(type) < 0) {
        throw new Error('You do not have a resolver for ' + importInfo.type + ' types.');
      }

      resolve = this.resolvers[type].resolve;

      this.cacheImport(importInfo, importer);

      if (resolve) {
        return resolve.call(this.resolvers[type], this.outputPath, importInfo, this);
      } else if (this.resolvers[type].resolveLater) { 
        return this.outputPath;
      } else {
        throw new Error('No `resolve` or `resolveLater` method on the dependency resolver.');
      }
    }, this);
  }
});