'use strict';

var path                    = require('path');
var AllDependencies         = require('../all-dependencies');
var syncForwardDependencies = require('../sync-forward-dependencies');
var fs                      = require('fs-extra');

module.exports = {
  _getEntry: function(relativePath) {
    return relativePath.split('/')[0];
  },

  resolve: function(srcDir, destDir, imprt, prePackager) {
    var entry = this._getEntry(imprt);
    imprt = entry === imprt ? entry + '/' + imprt + '.js' : imprt + '.js';
    var depGraph = fs.readJSONSync(path.join(srcDir, entry, 'dep-graph.json'));

    AllDependencies.update(entry, depGraph);

    var dependency = path.join(srcDir, imprt);
    var destination = path.join(destDir, imprt);
    syncForwardDependencies(destination, dependency);
    return prePackager.selectResolution(srcDir, destDir, AllDependencies.for(imprt), prePackager);

  }
};