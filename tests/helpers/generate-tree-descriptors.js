'use strict';

var path = require('path');

function generateTreeDescriptors(metas) {

  var descriptors = {};

  metas.forEach(function(treeMeta) {
    var pkg;
    var root;
    var type = treeMeta.type;
    var name;
    var nodeModulesPath;

    if (treeMeta.altName) {
      name = treeMeta.altName
    } else {
      name = treeMeta.name;
    }

    if (type === 'addon') {
      root = path.join(process.cwd(), 'tests/fixtures/example-app/node_modules/', name); 
    } else {
      root = path.join(process.cwd(), 'tests/fixtures/example-app');
    }

    nodeModulesPath = path.join(root, 'node_modules');
    pkg = require(path.join(root, 'package.json'));

    descriptors[name] = {
      packageName: name,
      root: root,
      nodeModulesPath: nodeModulesPath,
      pkg: pkg
    };

  });

  return descriptors;
}

module.exports = generateTreeDescriptors;