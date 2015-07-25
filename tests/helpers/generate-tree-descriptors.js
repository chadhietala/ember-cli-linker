'use strict';

var path = require('path');
var generateTrees = require('./generate-trees');
var walkSync = require('walk-sync');

function _createDesc(trees, descs) {
  return function(treeMeta, index) {
    var pkg;
    var root;
    var type = treeMeta.type;
    var name;
    var nodeModulesPath;

    if (treeMeta.altName) {
      name = treeMeta.altName;
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

    var desc = {
      type: type,
      name: name,
      packageName: name,
      root: root,
      nodeModulesPath: nodeModulesPath,
      pkg: pkg,
      relativePaths: [],
      tree: trees[index],
      updateRelativePaths: function() {
        this.relativePaths = walkSync(this.srcDir);
      }
    };

    if (descs) {
      descs[name] = desc;
    }

    return desc;
  };
}

function generateTreeDescriptors(metas, isSet) {
  var trees = generateTrees(metas);
  var descs = {};

  if (isSet) {
    return metas.map(_createDesc(trees));
  }

  metas.forEach(_createDesc(trees, descs));
  return descs;
}

module.exports = generateTreeDescriptors;
