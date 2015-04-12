'use strict';

var mori = require('mori');

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

    if (parts.length === 1) {

      // for() was passed a package name
      if (this._graph[fileOrPackage]) {
        return mori.toClj(this._graph[fileOrPackage]);
      }

      return mori.hashMap();
    }

    // for() was passed a file path
    if (this._graph[packageName][fileOrPackage]) {
      var imports = mori.seq(this._graph[packageName][fileOrPackage].imports);
      return mori.filter(function(imprt) {
        return imprt !== 'exports';
      }, imports);
    }
    
    return mori.list();
  }
};


module.exports = AllDependencies;