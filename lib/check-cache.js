'use strict';

var AllDependencies = require('./all-dependencies');
var fs              = require('fs-extra');
var mori            = require('mori');

module.exports = function(entry, graphPath) {
  var existingGraph = AllDependencies.for(entry);
  var newGraph = mori.toClj(fs.readJSONSync(graphPath));

  if (existingGraph !== newGraph) {
    AllDependencies.update(entry, newGraph);
    return false;
  }

  return true;
};

