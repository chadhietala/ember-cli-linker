'use strict';

var CoreObject = require('core-object');
var walkSync = require('walk-sync');

module.exports = CoreObject.extend({
  init: function(options) {
    this.root = options.root;
    this.packageName = options.packageName;
    this.nodeModulesPath = options.nodeModulesPath;
    this.pkg = options.pkg;
    this.relativePaths = options.relativePaths;
    this.parent = options.parent;
    this.name = options.name;
    this.srcDir = options.srcDir;
  },
  updateRelativePaths: function() {
    this.relativePaths = walkSync(this.srcDir);
  }
});