'use strict';

var fs                = require('fs-extra');
var path              = require('path');
var symlinkOrCopySync = require('symlink-or-copy').sync;

module.exports = function(destination, dependency) {
  if (!fs.existsSync(destination)) {
    fs.mkdirsSync(path.dirname(destination));
    symlinkOrCopySync(dependency, destination);
  }
};