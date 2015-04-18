'use strict';

var getImportInfo = require('./utils').getImportInfo;
var path = require('path');

var AllDependencies = {
  _graph: {},

  update: function(entry, dependencies) {
    if (arguments.length === 1 && typeof arguments[0] !== 'string') {
      throw Error('You must pass an entry and a dependency graph.');
    }

    var deps = {};
    Object.keys(dependencies).forEach(function(file) {
      var prunedFile = file.replace('.js', '');
      deps[prunedFile] = dependencies[file];
      var imports = deps[prunedFile].imports.slice();
      imports.splice(imports.indexOf('exports'), 1);
      deps[prunedFile] = imports;
    }, this);

    this._graph[entry] = deps;
  },

  /**
   * Given either a package name or file you will
   * be returned either the graph for the package
   * or a list of the imports for the file.
   *
   * @param  {String} fileOrPackage
   * @return {Map|List}
   */
  for: function(fileOrPackage) {
    var parts = fileOrPackage.split('/');
    var packageName = parts[0];
    var pkg;

    if (parts.length === 1) {
      var deps = this._graph[fileOrPackage];

      // for() was passed a package name
      if (deps) {
        return deps;
      }

      return {};
    }

    pkg = this._graph[packageName];

    // for() was passed a file path
    if (pkg && pkg[fileOrPackage]) {
      var pkg = getImportInfo(fileOrPackage).pkg;
      var pkgPath = require.resolve(path.join(process.cwd(), pkg));
      console.log(pkgPath);
      return {
        pkg: getImportInfo(fileOrPackage).pkg,
        pkgPath: pkgPath,
        fileImports: pkg[fileOrPackage]
      };
    }

    return [];
  }
};


module.exports = AllDependencies;
