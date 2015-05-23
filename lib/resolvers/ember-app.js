'use strict';

var path                    = require('path');
var AllDependencies         = require('../all-dependencies');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');
var fs                      = require('fs-extra');

module.exports = {
  resolve: function(destDir, imprtInfo, prePackager) {
    var descriptor = prePackager.treeDescriptors[imprtInfo.pkgName];
    var imprt = imprtInfo.name;
    var pkg = imprtInfo.pkgName;
    var srcDir = prePackager.treeDescriptors[pkg].srcDir;
    var dependency = path.join(srcDir, imprt);
    var destination = path.join(destDir, imprt);
    var depGraphSource = path.join(srcDir, pkg, 'dep-graph.json');
    var depGraphDestination = path.join(destDir, pkg, 'dep-graph.json');
    var depGraph = fs.readJSONSync(depGraphSource);

    AllDependencies.update(descriptor, depGraph);

    syncForwardDependencies(depGraphDestination, depGraphSource);
    syncForwardDependencies(destination + '.js', dependency + '.js');
    var depsFor = AllDependencies.for(imprt, pkg);

    return prePackager.selectResolution(pkg, depsFor);
  }
};