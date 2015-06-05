'use strict';

var path                    = require('path');
var AllDependencies         = require('../all-dependencies');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');
var fs                      = require('fs-extra');

module.exports = {
  resolve: function(destDir, importInfo, prePackager) {
    var descriptor = prePackager.treeDescriptors[importInfo.pkgName];
    var imprt = importInfo.name;
    var pkg = importInfo.pkgName;
    var srcDir = prePackager.treeDescriptors[pkg].srcDir;
    var dependency = path.join(srcDir, imprt);
    var destination = path.join(destDir, imprt);
    var depGraphFile = pkg + path.sep + 'dep-graph.json';
    var depGraphSource = path.join(srcDir, depGraphFile);
    var depGraphDestination = path.join(destDir, depGraphFile);
    var depGraph = fs.readJSONSync(depGraphSource);

    AllDependencies.update(descriptor, depGraph);

    syncForwardDependencies(pkg, depGraphDestination, depGraphSource, depGraphFile);
    syncForwardDependencies(pkg, destination + '.js', dependency + '.js', imprt + '.js');
    var depsFor = AllDependencies.for(imprt, pkg);
    return prePackager.selectResolution(pkg, depsFor);
  }
};