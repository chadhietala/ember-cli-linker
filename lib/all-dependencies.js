'use strict';

var Package       = require('./models/package');
var Descriptor    = require('./models/descriptor');
var array         = require('./utils/array');
var debug         = require('debug')('pre-packager');
var path          = require('path');
var without       = array.without;
var flatten       = array.flatten;
var intersect     = array.intersect;
var equal         = array.equal;
var head          = array.head;

function clone(obj) {
  var ret = {};

  Object.keys(obj).forEach(function(item)  {
    ret[item] = obj[item];
  });

  return ret;
}

var AllDependencies = {
  _graph: {},

  _synced: {},

  synced: function(packageName, importName) {
    if (!this._synced[packageName]) {
      this._synced[packageName] = [importName];
    } else if (this._synced[packageName].indexOf(importName) < 0) {
      this._synced[packageName].push(importName);
    }
  },

  getSynced: function(packageName) {
    if (packageName) {
      return this._synced[packageName];
    }

    return this._synced;
  },

  _normalizeFileName: function(fileName) {
    var ext = path.extname(fileName);
    if (ext === '') {
      return fileName + '.js';
    }

    return fileName;
  },

  isSynced: function(packageName, fileName) {
    return this._synced[packageName] && this._synced[packageName].indexOf(
      this._normalizeFileName(fileName)
    ) > -1;
  },

  add: function(descriptor, importName, graph) {
    debug('adding import: %s', importName);
    var name = descriptor.packageName;
    var _graph = {};
    _graph[importName] = graph;
    var flattenImports = Package.flattenImports(_graph);
    var imports = Package.collectImports(flattenImports);
    var pack;

    if (!this._graph[name]) {
      pack = this._graph[name] = new Package({
        descriptor: descriptor,
        dedupedImports: imports
      });
    } else {
      pack = this._graph[name];
      pack.addToDedupedImports(imports);
    }

    pack.addToGraph(importName, graph);
    pack.addToImports(importName, imports);
  },

  _collectTransitives: function(filesToRemove, depPath) {
    var self = this;
    depPath = depPath || [];

    return flatten(filesToRemove.map(function(file) {
      var packageName = file.split('/').shift();
      var deps = self._graph[packageName].imports[file];
      var intersection;

      if (deps.length === 0) {
        return depPath;
      }

      intersection = flatten(self._compareAgainstAllImports(function(allImports) {
        return intersect(allImports, deps);
      }));

      if (equal(deps, intersection) || intersection.length === 0) {
        depPath = depPath.concat(intersection);
        return self._collectTransitives(intersection, depPath);
      }

      return depPath;

    }, this));
  },

  _compareAgainstAllImports: function(comparingFn) {
    var packages = Object.keys(this._graph);
    return packages.map(function(packageName) {
      var packageImports = this._graph[packageName].imports;
      var allImports = flatten(Object.keys(packageImports).map(function(importName) {
        return packageImports[importName];
      }));

      return comparingFn(allImports);
    }, this);
  },

  _removalIntersection: function(filesToRemove) {
    return flatten(this._compareAgainstAllImports(function(allImports) {
      return intersect(allImports, filesToRemove);
    }));
  },

  _removeImportsFromSynced: function(removedFileImports) {
      var removalIntersection = this._removalIntersection(removedFileImports);
      var filesToRemove;
      var transitives;

      if (removalIntersection.length > 1 ) {
        filesToRemove = without(removedFileImports, removalIntersection);
      } else {
        transitives = this._collectTransitives(removedFileImports);
        filesToRemove = removedFileImports.concat(transitives);
      }

      var packageNames = filesToRemove.map(function(file) {
        return file.split('/').shift();
      });

      filesToRemove = filesToRemove.map(function(file) {
        return file + '.js';
      });

      packageNames.forEach(function(packageName) {
        this._synced[packageName] = without(this._synced[packageName], filesToRemove);

        if (this._synced[packageName].length === 0) {
          delete this._synced[packageName];
        }

      }, this);
  },

  _diffSynced: function(packageName, currentImportHash, newImportHash, dependencies) {
    var currentFiles = Object.keys(currentImportHash).sort();
    var newFiles = Object.keys(newImportHash).sort();
    var fileRemoved = currentFiles.length > newFiles.length;
    var removedFileImports = [];
    var importsRemoved;
    var newImports;
    var currentImports;
    var fileWithUnstableImports = head(currentFiles.filter(function(file) {
      return !equal(currentImportHash[file], newImportHash[file]);
    }));

    var pack = this._graph[packageName];

    if (fileRemoved) {
      var removedFile = head(without(currentFiles, newFiles));
      removedFileImports = currentImportHash[removedFile];
      this._removeImportsFromSynced(removedFileImports);
    }

    if (fileWithUnstableImports) {
      currentImports = currentImportHash[fileWithUnstableImports];
      newImports = newImportHash[fileWithUnstableImports];
      importsRemoved = (currentImports.length > newImports.length);

      if (importsRemoved) {
        removedFileImports = without(currentImports, newImports);
        this._removeImportsFromSynced(removedFileImports);
      } else {
        // Note:
        // Imports are being added. We do not need to
        // do anything as the hashed graph will cause the subset
        // of the graph to be resolved. This will cause `syncForwardDependencies`
        // to place the new items into the graph because it calls `AllDependencies.synced()`
        // with the new imports as they are resolved.
      }
    }

    // NOTE:
    // Only update after the diffing has occured. If we do not we loose the previous state and cannot
    // effectly diff the graph.
    pack.updateDependencies(dependencies);
  },

  _updateExisting: function(packageName, dependencies) {
    var pack = this._graph[packageName];

    if (pack) {
      var currentImportHash = clone(pack.imports);
      var newImportHash = Package.flattenImports(dependencies);

      this._diffSynced(packageName, currentImportHash, newImportHash, dependencies);

    } else {
      throw new Error('Attempted to update ' + packageName + ' that has never been resolved.');
    }
  },

  update: function(descriptor, graph) {
    if (arguments.length === 1 && typeof arguments[0] !== 'object') {
      throw Error('You must pass a descriptor and a dependency graph.');
    }
    var name = descriptor.packageName;

    debug('updating graph with: %s', name);

    if (this._graph[name]) {
      this._updateExisting(name, graph);
      return;
    }

    if (!(descriptor instanceof Descriptor)) {
      descriptor = new Descriptor(descriptor);
    }

    graph = Package.removeFileExtensionsFromGraph(graph);
    var imports = Package.flattenImports(graph);
    var dedupedImports = Package.dedupeImports(imports);

    this._graph[name] = new Package({
      descriptor: descriptor,
      graph: graph,
      imports: imports,
      dedupedImports: dedupedImports
    });
  },

  /**
   * Given either a package name or file you will
   * be returned either the graph for the package
   * or a list of the imports for the file.
   *
   * @param  {String} fileOrPackage
   * @return {Map|List}
   */
  for: function(fileOrPackage, parent) {
    var graph = this._graph[fileOrPackage];
    var isRequestingPackage = graph && !parent;
    var isRequestingFileInPackage = !graph && this._graph[parent];
    var isRequestingMainFile = fileOrPackage === parent;

    if (isRequestingPackage) {
      return graph;
    } else if (isRequestingFileInPackage) {
      return this._graph[parent].imports[fileOrPackage] || [];
    } else if (isRequestingMainFile) {
      return this._graph[parent].imports[fileOrPackage];
    } else {
      throw new Error(fileOrPackage + ' cannot be found.');
    }

  }
};

module.exports = AllDependencies;
