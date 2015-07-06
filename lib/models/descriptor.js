'use strict';

var CoreObject = require('core-object');
var walkSync = require('walk-sync');

/**
 * The Descriptor is a class that contains meta data about
 * trees passed into the linker. It is used as the source of
 * truth for original paths on disk. A descriptor belongs to
 * a Package class.
 */
module.exports = CoreObject.extend({
  init: function(options) {
    this.root = options.root;
    this.packageName = options.packageName;
    this.nodeModulesPath = options.nodeModulesPath;
    this.pkg = options.pkg;
    this.relativePaths = options.relativePaths;
    this.parent = options.parent;
    this.srcDir = options.srcDir;
  },
  updateRelativePaths: function() {
    this.relativePaths = walkSync(this.srcDir);
  }
});
