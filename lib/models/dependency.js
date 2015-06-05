'use strict';

var CoreObject = require('core-object');
var array = require('../utils/array');
var uniq  = array.uniq;
var flatten = array.flatten;

var Dependency = CoreObject.extend({
  init: function(options) {
    options = options || {};
    this.descriptor = options.descriptor || {};
    this.graph = options.graph || {};
    this.imports = options.imports || {};
    this.dedupedImports = options.dedupedImports || [];
  },
  addToGraph: function(importee, graph) {
    this.graph[importee] = graph;
  },
  addToDedupedImports: function (imports) {
    this.dedupedImports = this.dedupedImports.concat(imports);
    this.dedupedImports = uniq(this.dedupedImports);
  },
  addToImports: function (importee, imports) {
    this.imports[importee] = imports;
  },
  updateDepenencies: function(graph) {
    this.imports = Dependency.flattenImports(graph);
    this.dedupedImports = Dependency.dedupeImports(this.imports);
    this.graph = graph;
    this.descriptor.updateRelativePaths();
  }
});

Dependency.flattenImports = function(dependencies) {
  var imports = {};
  Object.keys(dependencies).forEach(function(file) {
    var fileName = file.replace(/\.js$/, '');
    var dependency = dependencies[file];
    var fileImports = Dependency.removeExports(dependency.imports);
    imports[fileName] = fileImports;
  });
  return imports;
};

Dependency.dedupeImports = function(imports) {
  return uniq(flatten(Object.keys(imports).map(function(importer) {
    return uniq(imports[importer]);
  })));
};

Dependency.removeExports = function(imports) {
  return imports.filter(function(imprt) {
    return imprt !== 'exports';
  });
};

module.exports = Dependency;