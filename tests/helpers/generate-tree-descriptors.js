'use strict';

var gatherTreeNames = require('./gather-tree-names');
var path = require('path');

function generateTreeDescriptors(paths) {
  var treeNames = gatherTreeNames(paths);

  var descriptors = {};

  treeNames.forEach(function(name) {
    var pkg;
    var root;
    var nodeModulesPath;

    if (name !== 'example-app') {
      root = path.join(process.cwd(), 'tests/fixtures/example-app/node_modules/', name); 
    } else {
      root = path.join(process.cwd(), 'tests/fixtures/example-app');
    }

    nodeModulesPath = path.join(root, 'node_modules');
    pkg = require(path.join(root, 'package.json'));

    descriptors[pkg.name] = {
      name: pkg.name,
      pkg: pkg,
      root: root,
      nodeModulesPath: nodeModulesPath
    };
  });

  return descriptors;
}

module.exports = generateTreeDescriptors;