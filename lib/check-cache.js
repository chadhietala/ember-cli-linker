'use strict';

var AllDependencies = require('./all-dependencies');
var fs              = require('fs-extra');
var mori            = require('mori');

function updateGraph(entry, graphPath) {
  AllDependencies.update(entry, fs.readJSONSync(graphPath));
}

module.exports = function(entry, graphPath) {
  var existingGraph = AllDependencies.for(entry);
  var newGraph = mori.toClj(fs.readJSONSync(graphPath));

  if (existingGraph !== newGraph) {
    updateGraph(entry, graphPath);
    return false;
  }

  return true;
};

