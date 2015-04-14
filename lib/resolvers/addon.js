'use strict';

var path                    = require('path');
var AllDependencies         = require('../all-dependencies');
var syncForwardDependencies = require('../sync-forward-dependencies');
var getImportInfo           = require('../utils').getImportInfo;
var fs                      = require('fs-extra');

module.exports = {
  resolve: function(srcDir, destDir, imprt, prePackager) {
    var pkg = getImportInfo(imprt).pkg;
    imprt = pkg === imprt ? pkg + '/' + imprt + '.js' : imprt + '.js';
    var dependency = path.join(srcDir, imprt);
    var destination = path.join(destDir, imprt);
    var depGraph = fs.readJSONSync(path.join(srcDir, pkg, 'dep-graph.json'));

    AllDependencies.update(pkg, depGraph);

    syncForwardDependencies(destination, dependency);
    return prePackager.selectResolution(srcDir, destDir, AllDependencies.for(imprt), prePackager);

  }
};