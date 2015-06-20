'use strict';

var stew = require('broccoli-stew');
var rename = stew.rename;
var find = stew.find;

function checkForDepGraph(relativePath) {
  if (relativePath.indexOf('dep-graph.json') > -1) {
    return 'dep-graph.json';
  } else {
    return relativePath;
  }
}

function setupLoadPath(relativePath) {
  var parts = relativePath.split('/');

  if (parts.length <= 2) {
    return parts[parts.length - 1];
  } else {
    parts.shift();
    return parts.join('/');
  }
}

function generateTrees(trees) {
  var addons = trees.filter(function(treeMeta) {
    return treeMeta.type === 'addon';
  });

  var app = trees.filter(function(treeMeta) {
    return treeMeta.type === 'app';
  });

  var tests = trees.filter(function(treeMeta) {
    return treeMeta.type === 'tests';
  });

  var appTree = app.map(function(treeMeta) {
    var tree = rename(find('tree/' + treeMeta.name), function(relativePath) {
      return checkForDepGraph(relativePath).replace('tree/', '');
    });

    tree.name = treeMeta.name;
    return tree;
  });

  var testTree = tests.map(function(treeMeta) {
    var tree = rename(find('tree/' + treeMeta.name), function(relativePath) {
      return checkForDepGraph(relativePath).replace('tree/tests/', treeMeta.altName +'/');
    });

    tree.name = treeMeta.altName;
    return tree;
  });

  var addonTrees = addons.map(function(treeMeta) {
    var tree = rename(find('tree/' + treeMeta.name), function(relativePath) {
      return checkForDepGraph(setupLoadPath(relativePath.replace('tree/', '')));
    });

    tree.name = treeMeta.name;
    return tree;
  });

  return appTree.concat(testTree, addonTrees);
}

module.exports = generateTrees;