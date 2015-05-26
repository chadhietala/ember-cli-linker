'use strict';

var gatherTreeNames = require('./gather-tree-names');
var stew = require('broccoli-stew');
var rename = stew.rename;
var find = stew.find;

function generateTrees(paths) {
  return gatherTreeNames(paths).map(function(dir) {
    var tree = rename(find('tree/' + dir), function(relativePath) {
      return relativePath.replace('tree/', '');
    });
    tree.name = dir;
    return tree;
  });
}

module.exports = generateTrees;