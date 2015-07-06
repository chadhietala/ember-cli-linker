'use strict';

var path                    = require('path');
var AllDependencies         = require('../all-dependencies');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');
var fs                      = require('fs-extra');

module.exports = {

  /**
   * Resolves Ember packages including Apps, Addons, and Engines.  Takes an import and links it to the destination. Will then look up any dependencies and the synced import and recursive resolve.
   * @param  {String} destDir    The path to where source files will be linked to
   * @param  {Import} importInfo Instance of an Import model
   * @param  {Linker} linker     The Linker instance
   * @return {Promise}
   */
  resolve: function(destDir, importInfo, linker) {
    var descriptor = linker.treeDescriptors[importInfo.packageName];
    var importName = importInfo.importName;
    var packageName = importInfo.packageName;
    var DEP_GRAPH = 'dep-graph.json';
    var relativePath = importName + '.js';
    var srcDir = linker.treeDescriptors[packageName].srcDir;
    var source = path.join(srcDir, relativePath);
    var destination = path.join(destDir, relativePath);
    var depGraphSource = path.join(srcDir, DEP_GRAPH);
    var depGraph = fs.readJSONSync(depGraphSource);

    AllDependencies.update(descriptor, depGraph);

    var deps = AllDependencies.for(importName, packageName);

    syncForwardDependencies({
      destination: destination,
      source: source,
      node: {
        tail: importName,
        heads: deps
      },
      meta: {
        relativePath: relativePath,
        packageName: packageName,
        type: importInfo.type
      }
    });

    return linker.selectResolution(packageName, deps, importName);
  }
};
