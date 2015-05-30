'use strict';

var CoreObject = require('core-object');

module.exports = CoreObject.extend({
  init: function(options) {
    this.root = options.root;
    this.pkgName = options.pkgName;
    this.nodeModulesPath = options.nodeModulesPath;
    this.pkg = options.pkg;
    this.relativePaths = options.relativePaths;
    this.parent = options.parent;
    this.name = options.name;
  }
});