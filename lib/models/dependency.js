'use strict';

var CoreObject = require('core-object');
var uniq = require('../utils').uniq;

module.exports = CoreObject.extend({
  descriptor: {},
  graph: {},
  imports: {},
  dedupedImports: [],
  addToGraph: function(importee, graph) {
    this.graph[importee] = graph;
  },
  addToDedupedImports: function (imports) {
    this.dedupedImports = uniq(this.dedupedImports.concat(imports));
  },
  addToImports: function (importee, imports) {
    this.imports[importee] = imports;
  }
});