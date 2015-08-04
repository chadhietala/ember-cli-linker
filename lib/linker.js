'use strict';

var AllDependencies         = require('./all-dependencies');
var syncForwardDependencies = require('./utils/sync-forward-dependencies');
var Package                 = require('./models/package');
var Import                  = require('./models/import');
var RSVP                    = require('rsvp');
var walkSync                = require('walk-sync');
var path                    = require('path');
var fs                      = require('fs-extra');
var mapSeries               = require('promise-map-series');
var stringify               = require('json-stable-stringify');
var debug                   = require('debug')('linker');
var Plugin                  = require('broccoli-plugin');
var dot                     = require('graphlib-dot');
var getImportInfo           = Import.getInfo;
var getPackageName          = Package.getName;
var uniq                    = require('lodash-node/modern/array/uniq');
var without                 = require('lodash-node/modern/array/without');
var head                    = require('lodash-node/modern/array/head');

module.exports = Linker;
Linker.prototype = Object.create(Plugin.prototype);
Linker.prototype.constructor = Linker;

function Linker(inputNodes, options) {
  if (!(this instanceof Linker)) {
    return new Linker(inputNodes, options);
  }

  if (!Array.isArray(inputNodes)) {
   throw new Error('Expected array, got ' + inputNodes);
  }

  options = options || {};
  Plugin.call(this, inputNodes, {
    annotation: 'Ember CLI Linker'
  });
  var defaultResolvers = ['ember-app', 'npm', 'es'];
  this.initialBuild = true;
  this.resolvers = {};
  this.legacyImports = options.legacyImports || [];
  this.options = options || {};
  this._graphs = {};
  this.extension = '.js';

  if (!this.options.entries) {
    throw new Error('You must pass an array of entries.');
  }

  if (!options.treeDescriptors) {
    throw new Error('You must pass TreeDescriptors that describe the trees in the project.');
  }

  this.orderedDescriptors = options.treeDescriptors.ordered;
  this.treeDescriptors = options.treeDescriptors.map;

  if (options.resolutionTypes) {
    this.resolutionTypes = options.resolutionTypes.concat(defaultResolvers);
  } else {
    this.resolutionTypes = defaultResolvers;
  }

  function Resolver() {}
  this.resolutionTypes.forEach(function(type) {
    Resolver.prototype = require('./resolvers/' + type);
    this.resolvers[type] = new Resolver();
  }, this);

  this.initialRoots = options.entries;
  AllDependencies.setRoots(this.initialRoots);
}

/**
 * Decorates the tree descriptors with the source directory that is given by broccoli and also sets the relative paths for the tree.
 * @return {Nil}
 */
Linker.prototype.decorateTreeDescriptors = function() {
  this.orderedDescriptors.forEach(function(desc, index) {
    var srcDir = this.inputPaths[index];
    var relativePaths = walkSync(srcDir);

    this.treeDescriptors[desc.name].relativePaths = relativePaths;
    this.treeDescriptors[desc.name].srcDir = srcDir;

    desc.srcDir = srcDir;
    desc.relativePaths = relativePaths;
  }, this);
};

Linker.prototype._isLegacy = function(importName) {
  if (this.legacyImports.length > 0) {
    return this.legacyImports.every(function(legacyMeta) {
      return legacyMeta.files.indexOf(importName) > 0;
    });
  }

  return false;
};

/**
 * Gathers graphs by their name
 * @return {Object} An object that is used to derive cache hit / miss
 */
Linker.prototype._graphsByName = function(descriptors) {
  var graphs = {};

  descriptors.forEach(function(desc) {
    var name = desc.name;
    var srcDir = desc.srcDir;
    var depGraphPath = path.join(srcDir, 'dep-graph.json');
    var denormalizedGraph;

    if (fs.existsSync(depGraphPath)) {
      denormalizedGraph = fs.readJSONSync(depGraphPath);
    } else if (AllDependencies.for(name)) {
      denormalizedGraph = AllDependencies.for(name).denormalizedGraph;
    } else {
      throw new Error('Cannot find graph for ' + name);
    }

    graphs[name] = {
      name: name,
      denormalizedGraph: denormalizedGraph
    };
  }, this);

  return graphs;
};

/**
 * Compares the current hashes and the new hashes and then determines if a package has been mutated and thus we need to re-resolve it's graph.
 * @return {Array} The mutated packages
 */
Linker.prototype.diffGraph = function() {
  var existingGraphs = this._graphs;
  var existing = Object.keys(this._graphs);
  var incomingGraphs = this._graphsByName(AllDependencies.getDescriptors());

  var unstable = existing.filter(function(name) {
    var denormalizedGraph = existingGraphs[name].denormalizedGraph;
    return stringify(incomingGraphs[name].denormalizedGraph) !== stringify(denormalizedGraph);
  }, this).map(function(name) {
    return incomingGraphs[name];
  });

  if (unstable.length > 0) {
    unstable.forEach(function(obj) {
      this._graphs[obj.name] = obj;
    }, this);
  }

  return unstable;
};

Linker.prototype.moveEngines = function() {
  var engines = AllDependencies.graphForEngines();

  Object.keys(engines).forEach(function(engine) {
    engines[engine].map(byFileName).forEach(function(file) {
      var enginesPath = path.join(this.outputPath, 'engines', engine, file);
      var sourcePath = path.resolve(this.outputPath, file);
      var legacyFile = this._lookupLegacyFile(file);

      if (fs.existsSync(sourcePath) && !fs.existsSync(enginesPath)) {
        fs.mkdirsSync(path.dirname(enginesPath));
        fs.writeFileSync(enginesPath, fs.readFileSync(sourcePath));
        fs.removeSync(sourcePath);
      } else if (legacyFile) {
        // TODO link the legacy file
      }
    }, this);
  }, this);
};

Linker.prototype._lookupLegacyFile = function(file) {
  var fileMeta = head(this.legacyImports.filter(function(legacyMeta) {
    return legacyMeta.files.indexOf(file) > 0;
  }));

  if (fileMeta) {
    return fileMeta.path;
  }

  return null;
};

Linker.prototype.exportGraph = function() {
  var dotlang = dot.write(AllDependencies.graph);
  fs.writeFileSync(path.resolve(this.outputPath, 'dep-graph.dot'), dotlang);
};

/**
 * Syncs all of the nodes in the graph that were not effected by the mutation of the graph.
 * @param  {Array} stablePackages All of the stable packages
 * @return {Nil}
 */
Linker.prototype.syncForwardStablePackages = function(stablePackages) {
  AllDependencies.byPackageNames(stablePackages).forEach(function(node) {
    var meta = AllDependencies.getNodeMeta(node);
    syncForwardDependencies({
      source: meta.source,
      destination: meta.destination
    });
  });
};

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
 * @method `build`
 */
Linker.prototype.build = function() {
  this.decorateTreeDescriptors();
  var diffs;

  // we may need to explore/test what happens when entries change (Are added or are removed);
  if (this.initialBuild) {
    this._graphs = this._graphsByName(this.orderedDescriptors);

    // seed the changes, as the roots;
    diffs = this.initialRoots.map(this._rootToDiff.bind(this));
  } else {
    diffs = this.diffGraph();
  }

  this._updateDepGraphs(diffs);

  var stablePackages = without(AllDependencies.getSyncedPackages(), diffs.map(byName));
  this.syncForwardStablePackages(stablePackages);
  this.initialBuild = false;
  return this.resolve(diffs.map(byName)).then(function() {
    this.exportGraph();
    this.moveEngines();
  }.bind(this));
};

/**
 * Takes an array of diff objects that represent a changed package.  This diff object is than used to update the graph and begins the
 * @param  {[type]} diffs [description]
 * @return {[type]}       [description]
 */
Linker.prototype._updateDepGraphs = function(diffs) {
  diffs.forEach(function(diff) {
    var treeName = diff.name;
    var desc = this.treeDescriptors[treeName];
    if (!desc) {
      throw new Error('missing [' + treeName + ']');
    }

    var name = desc.name;
    var graphPath = path.join(desc.srcDir, 'dep-graph.json');
    var depgraph = fs.readJSONSync(graphPath);

    AllDependencies.update(desc, depgraph);
    this.syncForwardRoot(name);
  }, this);
};

/**
 * Given a package and it's relativePaths for the package sync forward it's files.
 * @param  {String} packageName   The name of the package we are syncing
 * @param  {Array} relativePaths The relative paths to the imports in the package
 * @return {Nil}
 */
Linker.prototype.syncForwardRoot = function(name) {
  var pack = AllDependencies.for(name);
  var srcDir = pack.descriptor.srcDir;
  var imports = Object.keys(pack.imports);

  imports.forEach(function(importName) {
    var importInfo = getImportInfo(this.treeDescriptors, {
      importName: importName,
      packageName: name,
      importerName: null,
      importerPackageName: name
    });

    var type = importInfo.type;
    var relativePath = importName + this.extension;
    var destination = path.join(this.outputPath, relativePath);
    var source = path.join(srcDir, relativePath);

    syncForwardDependencies({
      destination: destination,
      source: source,
      node: {
        tail: importName,
        heads: pack.imports[importName]
      },
      meta: {
        relativePath: relativePath,
        packageName: name,
        type: type
      }
    });
  }, this);
};

/**
 * Entry resolution method that is responsible forking off to the different macro level resolution types:
 *   - Discoverable
 *   - Opaque
 *
 * A discoverable resolution type is one that can fully resolve a graph by simply crawling the edges of nodes in the graph. This is the prefered case by the linker.
 *
 * A opaque resolution type is one where the linker cannot effectively resolve outbound edges of a package.  An example of this is legacy modules from node_modules. The linker does not attempt to follow CJS modules instead it relies on browserify to crawl the graph as it is a much better suited tool for the job. The result of the running an opaque resolution is an opaque asset which contains all of it's dependcies.
 *
 * TODO if someone wants to take a stab at not forking and off into two resolution types feel free to change this.
 *
 *
 * @param  {Array} packageNames An array of packages to resolve
 * @return {Promise}           The result of a resolver
 */
Linker.prototype.resolve = function(packageNames) {
  return RSVP.Promise.all(packageNames.map(function(packageName) {
    var desc = this.treeDescriptors[packageName];

    if (!desc) {
      throw new Error('missing treeDescriptor: [' + packageName + ']');
    }
    var name = desc.name;
    var topLevelImports = Object.keys(AllDependencies.for(name).imports);

    var resolutions = topLevelImports.map(function(importName) {
      var imports = AllDependencies.for(importName, packageName);
      return this.selectResolution(name, imports, importName);
    }, this);

    return RSVP.Promise.all(resolutions);
  }, this)).then(function () {
    return RSVP.Promise.all(Object.keys(this.resolvers).map(function(resolver) {
      var resolveLater = this.resolvers[resolver].resolveLater;

      if (resolveLater) {
        return resolveLater.call(this.resolvers[resolver], this.outputPath, this.treeDescriptors, this);
      }
    }, this));
  }.bind(this));
};

/**
 * Selects a resolution path based on herustics described in Import.getInfo.
 * The result is a connected graph.
 * @param  {String} packageName The name of the package we are resolving.
 * @param  {Array} imports     The imports in a given package
 * @param  {String} importer    The of the name of the import that is the tail node in the graph
 * @return {Promise}             A promise that results in a connected graph on disk
 */
Linker.prototype.selectResolution = function(packageName, imports, importer) {
  return mapSeries(imports, function(importee) {
    var _packageName = getPackageName(importee, packageName);
    var isLegacy = this._isLegacy(importee);

    if (isLegacy) {
      return this.outputPath;
    }

    var importInfo = getImportInfo(this.treeDescriptors, {
      importName: importee,
      packageName: _packageName,
      importer: importer,
      importerPackageName: packageName
    });
    var type = importInfo.type;
    var resolve = this.resolvers[type].resolve;

    var isSynced = AllDependencies.isSynced(importee);
    var isOpaqueType = this.resolvers[type].resolveLater;



    debug('packageName: %s, importee: %s, packageName: %s', packageName, importee, packageName);

    if (isOpaqueType || isSynced) {
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
};

/**
 * Given a root look the diff for it
 * @param  {String} root Name of package
 * @return {Object}      The object that represents the cache key
 */
Linker.prototype._rootToDiff = function(root) {
  return this._graphs[root];
};

function byName(root) {
  return root.name;
}

function byFileName(file) {
  return file + '.js';
}
