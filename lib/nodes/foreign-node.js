'use strict';

var resolve = require('resolve').sync;
var resolvePackage = require('../utils').resolvePackage;

function foreignNode(packageName, graph, file, pkgInfo) {
  var entry = pkgInfo.parent.entry;
  var mainFile = resolve(packageName, { basedir: entry });
  var index = mainFile.indexOf(file);
  var isMain = (mainFile.substr(index, mainFile.length).replace('.js', '') === file);

  if (isMain) {
    pkgInfo.imports = graph[packageName];
  } else {
    pkgInfo.imports = graph[file];
  }

  pkgInfo.entry = entry;
  pkgInfo.pkgPath = resolvePackage(packageName, entry);
  return pkgInfo;
}

module.exports = foreignNode;