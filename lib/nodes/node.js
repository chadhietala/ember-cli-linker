'use strict';

var utils = require('../utils');
var resolvePackage = utils.resolvePackage;

function node(packageName, imports, pkgInfo, mergedWith) {
  var name = require(process.cwd() + '/package.json').name;
  var parent = pkgInfo.parent;

  if (name === packageName || mergedWith === name) {
    pkgInfo.pkgPath = process.cwd();
  } else {
    pkgInfo.pkgPath = resolvePackage(packageName, parent.pkgPath);
  }

  pkgInfo.pkgName = packageName;
  pkgInfo.entry = packageName;
  pkgInfo.imports = imports;
  return pkgInfo;
}

module.exports = node;
