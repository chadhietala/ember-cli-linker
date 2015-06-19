'use strict';

var CoreObject = require('core-object');
var array = require('../utils/array');
var uniq  = array.uniq;
var flatten = array.flatten;

var Package = CoreObject.extend({
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
  updateDependencies: function(graph) {
    this.imports = Package.flattenImports(graph);
    this.dedupedImports = Package.dedupeImports(this.imports);
    this.graph = graph;
    this.descriptor.updateRelativePaths();
  }
});

Package.flattenImports = function(dependencies) {
  var imports = {};
  Object.keys(dependencies).forEach(function(file) {
    var fileName = file.replace(/\.js$/, '');
    var dependency = dependencies[file];

    imports[fileName] = dependency.imports.map(function(importee) {
      return importee.source;
    });

  });
  return imports;
};

Package.dedupeImports = function(imports) {
  return uniq(flatten(Object.keys(imports).map(function(importer) {
    return uniq(imports[importer]);
  })));
};

Package.removeExports = function(imports) {
  return imports.filter(function(imprt) {
    return imprt !== 'exports';
  });
};

module.exports = Package;