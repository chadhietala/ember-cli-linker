'use strict';
var path = require('path');

function leafNode(pkgInfo) {
  pkgInfo.pkgPath = pkgInfo.parent.pkgPath;
  pkgInfo.nodeModulesPath = path.join(pkgInfo.parent.pkgPath, 'node_modules');
  pkgInfo.imports = [];
  return pkgInfo;
}

module.exports = leafNode;