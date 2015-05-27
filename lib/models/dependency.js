'use strict';

var CoreObject = require('core-object');
var uniq = require('../utils/array').uniq;

module.exports = CoreObject.extend({
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
  }
});