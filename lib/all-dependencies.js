'use strict';

var Package       = require('./models/package');
var Descriptor    = require('./models/descriptor');
var array         = require('./utils/array');
var diff          = array.diff;
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

  isSynced: function(packageName, fileName) {
    return this._synced[packageName] && this._synced[packageName].indexOf(fileName) > -1;
  },

  add: function(descriptor, importName, graph) {
    var name = descriptor.packageName;
    var imports = Package.removeExports(graph.imports);
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

  _removalIntersection: function(filesToRemove) {
    var packages = Object.keys(this._graph);
    var self = this;

    return flatten(packages.map(function(packageName) {
      var packageImports = self._graph[packageName].imports;
      var allImports = flatten(Object.keys(packageImports).map(function(importName) {
        return packageImports[importName];
      }));

      return intersect(allImports, filesToRemove);
    }));
  },

  _removeImportsFromSynced: function(removedFileImports) {
      var removalIntersection = this._removalIntersection(removedFileImports);
      var filesToRemove;

      if (removalIntersection.length > 1 ) {
        filesToRemove = diff(removedFileImports, removalIntersection);
      } else {
        filesToRemove = removedFileImports;
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

  _diffSynced: function(packageName, currentImportHash, newImportHash) {
    var currentFiles = Object.keys(currentImportHash).sort();
    var newFiles = Object.keys(newImportHash).sort();
    var fileRemoved = currentFiles.length !== newFiles.length;
    var removedFileImports = [];
    var importsRemoved;
    var newImports;
    var currentImports;
    var fileWithRemovals = head(currentFiles.filter(function(file) {
      return !equal(currentImportHash[file], newImportHash[file]);
    }));

    if (fileRemoved) {
      var removedFile = head(diff(currentFiles, newFiles));
      removedFileImports = currentImportHash[removedFile];
      this._removeImportsFromSynced(removedFileImports);
      return;
    }

    if (fileWithRemovals) {
      currentImports = currentImportHash[fileWithRemovals];
      newImports = newImportHash[fileWithRemovals];
      importsRemoved = (currentImports.length > newImports.length);
      removedFileImports = diff(currentImports, newImports);
      this._removeImportsFromSynced(removedFileImports);
      return;
    }

    this._synced[packageName].imports = newImportHash;

  },

  updateExisting: function(packageName, dependencies) {
    var pack = this._graph[packageName];

    if (pack) {
      var currentImportsHash = clone(pack.imports);
      var newImportHash;
      pack.updateDependencies(dependencies);
      newImportHash = clone(pack.imports);

      this._diffSynced(packageName, currentImportsHash, newImportHash);

    } else {
      throw new Error('Attempted to update ' + packageName + ' that has never been resolved.');
    }
  },

  update: function(descriptor, dependencies) {
    if (arguments.length === 1 && typeof arguments[0] !== 'object') {
      throw Error('You must pass a descriptor and a dependency graph.');
    }
    var name = descriptor.packageName;

    if (this._graph[name]) {
      this.updateExisting(name, dependencies);
      return;
    }

    if (!(descriptor instanceof Descriptor)) {
      descriptor = new Descriptor(descriptor);
    }

    var imports = Package.flattenImports(dependencies);
    var dedupedImports = Package.dedupeImports(imports);

    this._graph[name] = new Package({
      descriptor: descriptor,
      graph: dependencies,
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