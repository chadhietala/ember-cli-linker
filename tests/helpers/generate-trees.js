'use strict';

var gatherTreeNames = require('./gather-tree-names');
var stew = require('broccoli-stew');
var rename = stew.rename;
var find = stew.find;

function generateTrees(paths) {
  return gatherTreeNames(paths).map(function(dir) {
    var tree = rename(find('tree/' + dir), function(relativePath) {
      var path = relativePath.replace('tree/', '');
      var parts = path.split('/');
      var fileName = parts[parts.length - 1];
      var id = fileName.replace(/\.js$/, '');

      if (id === parts[0]) {
        return fileName;
      } else if (parts[0] === parts[1]) {
        parts.splice(0, 1);
        return parts.join('/');
      } else {
        return path;
      }
    });
    tree.name = dir;
    return tree;
  });
}

module.exports = generateTrees;