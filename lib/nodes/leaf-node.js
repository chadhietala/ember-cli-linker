'use strict';

function leafNode(pkgInfo) {
  pkgInfo.pkgPath = process.cwd();
  pkgInfo.imports = [];
  pkgInfo.entry = pkgInfo.parent.entry;
  return pkgInfo;
}

module.exports = leafNode;