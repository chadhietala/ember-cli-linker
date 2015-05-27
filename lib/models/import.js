'use strict';

var CoreObject = require('core-object');

module.exports = CoreObject.extend({
  init: function(options) {
    this.importer = options.importer;
    this.pkgName = options.pkgName;
    this.name = options.name;
    this.type = options.type;
  }
});