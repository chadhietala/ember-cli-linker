'use strict';

var path                    = require('path');
var AllDependencies         = require('../all-dependencies');
var syncForwardDependencies = require('../sync-forward-dependencies');
var fs                      = require('fs-extra');

module.exports = {
  resolve: function(destDir, imprtInfo, prePackager, pkgInfo) {
    var imprt = imprtInfo.name;
    var pkg = imprtInfo.pkgName;
    var srcDir = prePackager.parsedTrees[pkg].inputPath;
    var dependency = path.join(srcDir, imprt);
    var destination = path.join(destDir, imprt);
    var depGraphSource = path.join(srcDir, pkg, 'dep-graph.json');
    var depGraphDestination = path.join(destDir, pkg, 'dep-graph.json');
    var depGraph = fs.readJSONSync(depGraphSource);

    AllDependencies.update(pkg, depGraph);

    syncForwardDependencies(depGraphDestination, depGraphSource);
    syncForwardDependencies(destination + '.js', dependency + '.js');

    return prePackager.selectResolution(pkg, AllDependencies.for(imprt, pkgInfo));
  }
};