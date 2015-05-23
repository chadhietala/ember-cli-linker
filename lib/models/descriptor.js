var CoreObject = require('core-object');

module.exports = CoreObject.extend({
  root: '',
  pkgName: '',
  nodeModulesPath: '',
  pkg: {},
  parent: null
});