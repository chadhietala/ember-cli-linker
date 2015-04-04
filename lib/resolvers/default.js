'use strict';

var path                    = require('path');
var RSVP                    = require('rsvp');
var AllDependencies         = require('../all-dependencies');
var checkCache              = require('../check-cache');
var syncForwardDependencies = require('../sync-forward-dependencies');

module.exports = {
  _getEntry: function(relativePath) {
    return relativePath.split('/')[0];
  },

  resolve: function(srcDir, destDir, imprt, prePackager) {
    var entry = this._getEntry(imprt);
    imprt = entry === imprt ? entry + '/' + imprt + '.js' : imprt + '.js';
    var depGraph = path.join(srcDir, entry, 'dep-graph.json');


    if (!checkCache(entry, depGraph)) {
      var dependency = path.join(srcDir, imprt);
      var destination = path.join(destDir, imprt);
      syncForwardDependencies(destination, dependency);
      return prePackager.selectResolution(srcDir, destDir, AllDependencies.for(imprt), prePackager);
    }

    return RSVP.Promise.resolve(destDir);
  }
};