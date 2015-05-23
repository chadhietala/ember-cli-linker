'use strict';

var Dependency    = require('./models/dependency');
var Descriptor    = require('./models/descriptor');
var array         = require('./utils/array');
var uniq          = array.uniq;

function removeExports(imports) {
  var exportsIndex = imports.indexOf('exports');
  if (exportsIndex > -1) {
    imports.splice(exportsIndex, 1);
  }
  return imports;
}

var AllDependencies = {
  _graph: {},

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
    var prunedImports = [];

    // Today last one wins... tomorrow something else.
    Object.keys(dependencies).forEach(function(file) {
      var fileName = file.replace(/\.js$/, '');
      var dependency = dependencies[file];
      var fileImports = dependency.imports.slice();
      var exportsIndex = fileImports.indexOf('exports');
      if (exportsIndex > -1) {
        fileImports.splice(exportsIndex, 1);
      }

      prunedImports = prunedImports.concat(fileImports);
      imports[fileName] = fileImports;
    });

    this._graph[name] = new Dependency({
      descriptor: descriptor,
      graph: dependencies,
      imports: imports,
      dedupedImports: uniq(prunedImports)
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

    if (!graph && parent) {
      return this._graph[parent].imports[fileOrPackage];
    }

    return graph;
  }
};

module.exports = AllDependencies;