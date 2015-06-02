'use strict';

var Dependency    = require('./models/dependency');
var Descriptor    = require('./models/descriptor');
var array         = require('./utils/array');
var uniq          = array.uniq;

function removeExports(imports) {
  return imports.filter(function(imprt) {
    return imprt !== 'exports';
  });
}

var AllDependencies = {
  _graph: {},

  _synced: {},

  synced: function(packageName, dependency) {
    if (!this._synced[packageName]) {
      this._synced[packageName] = [dependency];
    } else if (this._synced[packageName].indexOf(dependency) < 0) {
      this._synced[packageName].push(dependency);
    }
  },

  getSynced: function(packageName) {
    if (packageName) {
      return this._synced[packageName];
    }

    return this._synced;
  },

  add: function(descriptor, importName, graph) {
    var name = descriptor.name;
    var imports = removeExports(graph.imports);
    var dependency;

    if (!this._graph[name]) {
      dependency = this._graph[name] = new Dependency({
        descriptor: descriptor,
        dedupedImports: imports
      });
    } else {
      dependency = this._graph[name];
      dependency.addToDedupedImports(imports);
    }

    dependency.addToGraph(importName, graph);
    dependency.addToImports(importName, imports);
  },

  update: function(descriptor, dependencies) {
    if (arguments.length === 1 && typeof arguments[0] !== 'object') {
      throw Error('You must pass a descriptor and a dependency graph.');
    }

    if (!descriptor instanceof Descriptor) {
      descriptor = new Descriptor(descriptor);
    }

    var name = descriptor.name;
    var imports = {};
    var dedupedImports = [];

    // Today last one wins... tomorrow something else.
    Object.keys(dependencies).forEach(function(file) {
      var fileName = file.replace(/\.js$/, '');
      var dependency = dependencies[file];
      var fileImports = removeExports(dependency.imports);

      dedupedImports = dedupedImports.concat(fileImports);
      imports[fileName] = fileImports;
    });

    this._graph[name] = new Dependency({
      descriptor: descriptor,
      graph: dependencies,
      imports: imports,
      dedupedImports: uniq(dedupedImports)
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