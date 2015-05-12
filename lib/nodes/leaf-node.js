'use strict';

function leafNode(pkgInfo) {
  pkgInfo.pkgPath = pkgInfo.parent.pkgPath;
  pkgInfo.imports = [];
  return pkgInfo;
}

module.exports = leafNode;