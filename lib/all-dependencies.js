'use strict';

var AllDependencies = {
  _graph: {},

  update: function(entry, dependencies) {
    if (arguments.length === 1 && typeof arguments[0] !== 'string') {
      throw Error('You must pass an entry and a dependency graph.');
    }

    this._graph[entry] = dependencies;
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
      return pkg[fileOrPackage].imports.filter(function(imprt) {
        return imprt !== 'exports';
      });
    }
    
    return [];
  }
};


module.exports = AllDependencies;