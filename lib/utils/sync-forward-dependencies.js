'use strict';

var fs                = require('fs-extra');
var path              = require('path');
var symlinkOrCopySync = require('symlink-or-copy').sync;
var AllDependencies   = require('../all-dependencies');

module.exports = function(packageName, destination, dependency) {
  if (!fs.existsSync(destination)) {
    fs.mkdirsSync(path.dirname(destination));
    symlinkOrCopySync(dependency, destination);
    AllDependencies.synced(packageName, dependency);
  }
};