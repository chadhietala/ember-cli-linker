'use strict';

var path                    = require('path');
var AllDependencies         = require('../all-dependencies');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');
var fs                      = require('fs-extra');

module.exports = {
  resolve: function(destDir, importInfo, prePackager) {
    var descriptor = prePackager.treeDescriptors[importInfo.packageName];
    var importName = importInfo.name;
    var packageName = importInfo.packageName;
    var srcDir = prePackager.treeDescriptors[packageName].srcDir;
    var dependency = path.join(srcDir, importName + '.js');
    var destination = path.join(destDir, importName + '.js');
    var depGraphFile = packageName + path.sep + 'dep-graph.json';
    var depGraphSource = path.join(srcDir, depGraphFile);
    var depGraphDestination = path.join(destDir, depGraphFile);
    var depGraph = fs.readJSONSync(depGraphSource);

    AllDependencies.update(descriptor, depGraph);

    syncForwardDependencies(packageName, depGraphDestination, depGraphSource, depGraphFile);
    syncForwardDependencies(packageName, destination, dependency, importName + '.js');
    var depsFor = AllDependencies.for(importName, packageName);
    return prePackager.selectResolution(packageName, depsFor);
  }
};