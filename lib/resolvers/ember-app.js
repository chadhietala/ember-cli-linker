'use strict';

var path                    = require('path');
var AllDependencies         = require('../all-dependencies');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');
var fs                      = require('fs-extra');

module.exports = {
  resolve: function(destDir, importInfo, linker) {
    var descriptor = linker.treeDescriptors[importInfo.packageName];
    var importName = importInfo.name;
    var packageName = importInfo.packageName;
    var srcDir = linker.treeDescriptors[packageName].srcDir;
    var dependency = path.join(srcDir, importName + '.js');
    var destination = path.join(destDir, importName + '.js');
    var depGraphSource = path.join(srcDir, 'dep-graph.json');
    var depGraphDestination = path.join(destDir, packageName + path.sep + 'dep-graph.json');
    var depGraph = fs.readJSONSync(depGraphSource);

    AllDependencies.update(descriptor, depGraph);

    syncForwardDependencies(packageName, depGraphDestination, depGraphSource, 'dep-graph.json');
    syncForwardDependencies(packageName, destination, dependency, importName + '.js');
    var depsFor = AllDependencies.for(importName, packageName);
    return linker.selectResolution(packageName, depsFor);
  }
};
