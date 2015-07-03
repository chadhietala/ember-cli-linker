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
var importInfo              = require('./utils/import-info');
var getImportInfo           = importInfo.getImportInfo;
var getPackageName          = importInfo.getPackageName;
var helpers                 = require('broccoli-kitchen-sink-helpers');
var symlinkOrCopySync       = require('symlink-or-copy').sync;
var stringify               = require('json-stable-stringify');
var debug                   = require('debug')('linker');
var zip                     = array.zip;
var uniq                    = array.uniq;
var without                 = array.without;

module.exports = CoreObject.extend({
  init: function(inputTrees, options) {
    options = options || {};
    var defaultResolvers = ['ember-app', 'npm', 'es'];
    this.initialBuild = true;
    this.resolvers = {};
    this.treeDescriptors = options.treeDescriptors;
    this.legacyImports = options.legacyImports || [];
    this.inputTrees = inputTrees;
    this.options = options || {};
    this.importCache = {};
    this.graphHashes = {};
    this.description = 'Ember CLI Linker';
    this.whitelist = ['__packager__', 'loader.js', 'ember-cli-shims'];

    if (Array.isArray(options.whitelist)) {
      this.whitelist = uniq(this.whitelist.concat(options.whitelist));
    }

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

    this.initialRoots = options.entries;
  },

  _treeNames: function() {
    return this.inputTrees.map(byName);
  },

  _eligibleTrees: function() {
    return zip(this._treeNames(), this.inputPaths).filter(function(treeNameAndPath) {
      var name = treeNameAndPath[0];
      var srcDir = treeNameAndPath[1];
      return name && srcDir;
    });
  },

  decorateTreeDescriptors: function() {
    var eligibleTrees = this._eligibleTrees();
    debug('eligibleTrees: %s', eligibleTrees);
    eligibleTrees.forEach(function(treeNameAndPath) {
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
      var depGraphPath = path.join(srcDir, 'dep-graph.json');
      var graph;

      if (fs.existsSync(depGraphPath)) {
        graph = fs.readJSONSync(depGraphPath);
        graphHashes[name] = {
          name: name,
          hash: helpers.hashStrings([stringify(graph)]),
          graph: graph
        };
      }
    });

    return graphHashes;
  },

  diffGraph: function() {
    var existingHashes = this.graphHashes;
    var existing = Object.keys(this.graphHashes);
    var incomingHashes = this.hashGraphs();

    var unstable = existing.filter(function(name) {
      var hash = existingHashes[name].hash;
      return incomingHashes[name].hash !== hash;
    }, this).map(function(name) {
      return incomingHashes[name];
    });

    if (unstable.length > 0) {
      unstable.forEach(function(hash) {
        this.graphHashes[hash.name] = hash;
      }, this);
    }

    return unstable;
  },

  syncForwardStablePackages: function(stablePackages) {
    var syncedItems = AllDependencies.getSynced();
    var outputPath = this.outputPath;
    stablePackages.forEach(function(name) {
      var srcBase = AllDependencies.for(name).descriptor.srcDir;
      syncedItems[name].forEach(function(file) {
        var srcPath = srcBase + path.sep + file;
        var destPath;

        // Ensure that dep-graph.json is namespaced in the output
        if (file === 'dep-graph.json') {
          destPath = outputPath + path.sep + name + path.sep + file;
        } else {
          destPath = outputPath + path.sep + file;
        }

        fs.mkdirsSync(path.dirname(destPath));

        symlinkOrCopySync(srcPath, destPath);
      });
    });
  },

  /*
   * this is a broccoli consumed API
   *
   * When broccoli builds, it calls this method. At which point in time, we
   * detect chanages in:
   *
   * - entries
   * - recursive dependencies of those entries
   *
   * Once all changes are detected, the reachable subgraph is calculated, built (or reused
   * from cache). Note: only the reachable subgraph is made available to
   * downstream broccoli plugins. Currently, this is designed to be consumed by
   * the ember-cli-packager.
   *
   * entry:
   *   - top-level tree
   *   - typically an app
   *   - tests
   *   - engines (likely once they land)
   *   - retained entirely (no tree shaking)
   *
   * dep:
   *   - ember
   *   - ember-data
   *   - rsvp
   *   - lodash-es
   *   - tree shaking based on reachability
   *
   * <entry>/files..
   * <entry1>/files..
   * <entry2>/files..
   *
   * <dep1>/reachable files...
   * deps1.js
   * <dep2>/reachable files...
   * deps2.js
   * <dep3>/reachable files...
   * deps3.js
   *
   * The result of this build is ultimately consumed by the packager.
   *
   * @public
   * @method rebuild
   */
  rebuild: function() {
    this.decorateTreeDescriptors();
    this.syncForwardNonGraphAssets();
    var diffs;

    // we may need to explore/test what happens when entries change (Are added or are removed);
    if (this.initialBuild) {
      this.initialBuild = false;
      this.graphHashes = this.hashGraphs();

      // seed the changes, as the roots;
      diffs = this.initialRoots.map(this._rootToDiff.bind(this));

    } else {
      diffs = this.diffGraph();
    }

    this._updateDepGraphs(diffs);

    var allPackages = Object.keys(AllDependencies.getSynced());
    var stablePackages = without(allPackages, diffs.map(byName));

    this.syncForwardStablePackages(stablePackages);

    return this.resolve(diffs.map(byName));
  },

  _updateDepGraphs: function(diffs) {

    diffs.forEach(function(diff) {
      var treeName = diff.name;
      var desc = this.treeDescriptors[treeName];
      if (!desc) {
        throw new Error('missing [' + treeName + ']');
      }
      var name = desc.packageName;
      var graphPath = path.join(desc.srcDir, 'dep-graph.json');
      var depgraph = fs.readJSONSync(graphPath);

      AllDependencies.update(desc, depgraph);

      this.syncForwardRoot(name, desc.relativePaths);
    }, this);
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
    zip(this.inputTrees, this.inputPaths).filter(function(treeAndPath) {
      var tree = treeAndPath[0];
      var name = tree.name;
      return (!name || this.whitelist.indexOf(name) > -1);
    }, this).map(function(treeAndPath) {
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

  syncForwardRoot: function(root, relativePaths) {
    var srcDir = this.treeDescriptors[root].srcDir;

    relativePaths.filter(function(relativePath) {
      return relativePath.slice(-1) !== '/';
    }).forEach(function(relativePath) {
      var destination;
      if (relativePath === 'dep-graph.json') {
        destination = path.join(this.outputPath, root, relativePath);
      } else {
        destination = path.join(this.outputPath, relativePath);
      }

      var source = path.join(srcDir, relativePath);

      syncForwardDependencies(root, destination, source, relativePath);
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
  resolve: function(treeNames) {
    return RSVP.Promise.all(treeNames.map(function(treeName) {
      var desc = this.treeDescriptors[treeName];
      if (!desc) {
        throw new Error('missing treeDescriptor: [' + treeName + ']');
      }
      var name = desc.packageName;
      return this.selectResolution(name, AllDependencies.for(name).dedupedImports);
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

  _containsImport: function(importInfo) {
    return Object.keys(this.importCache[importInfo.type]).some(function(packageName) {
      return this.importCache[importInfo.type][packageName].imports.some(function(info) {
        return info.name === importInfo.name;
      });
    }, this);
  },

  cacheImport: function(importInfo, importer) {
    var type = importInfo.type;
    var packageName = importInfo.packageName;
    var importCache = this.importCache;

    if (!importCache[type]) {
      importCache[type] = {};
      importCache[type][packageName] = {
        imports: [importInfo],
        parent: AllDependencies.for(importer)
      };
    } else if (!importCache[type][packageName]) {
      importCache[type][packageName] = {
        imports: [importInfo],
        parent: AllDependencies.for(importer)
      };
    } else if (!this._containsImport(importInfo)) {
      importCache[type][packageName].imports.push(importInfo);
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
      var packageName = getPackageName(importee, importer);
      var importInfo = getImportInfo(this.treeDescriptors, packageName, importee, importer);
      var type = importInfo.type;
      var resolve = this.resolvers[type].resolve;
      var isLegacy = this.legacyImports.indexOf(importee) > -1;
      var isSynced = AllDependencies.isSynced(importInfo.packageName, importee);
      var isOpaqueType = this.resolvers[type].resolveLater;

      debug('importer: %s, importee: %s, packageName: %s', importer, importee, packageName);

      this.cacheImport(importInfo, importer);

      if (isOpaqueType || isLegacy || isSynced) {
        return this.outputPath;
      }

      if (this.resolutionTypes.indexOf(type) < 0) {
        throw new Error('You do not have a resolver for ' + importInfo.type + ' types.');
      }

      resolve = this.resolvers[type].resolve;

      if (!isSynced && resolve) {
        return resolve.call(this.resolvers[type], this.outputPath, importInfo, this);
      } else {
        throw new Error('No `resolve` or `resolveLater` method on the dependency resolver.');
      }
    }, this);
  },
  _rootToDiff: function(root) {
    var hashEntry = this.graphHashes[root];
    return {
      name: hashEntry.name,
      hash: hashEntry.hash,
      graph: hashEntry.graph
    };
  }
});

function byName(root) {
  return root.name;
}
