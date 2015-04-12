'use strict';

var mori = require('mori');

var AllDependencies = {
  _graph: mori.hashMap(),

  update: function(entry, dependencies) {
    if (arguments.length === 1 && typeof arguments[0] !== 'string') {
      throw Error('You must pass an entry and a dependency graph.');
    }

    this._graph = mori.assoc(this.graph, entry, dependencies);
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
    var fileImports;

    if (parts.length === 1) {
      var deps = mori.get(this._graph, fileOrPackage);

      // for() was passed a package name
      if (deps) {
        return deps;
      }

      return mori.hashMap();
    }

    fileImports = mori.getIn(this._graph, [packageName, fileOrPackage]);

    // for() was passed a file path
    if (fileImports) {
      var imports = mori.seq(mori.get(fileImports, 'imports'));
      return mori.filter(function(imprt) {
        return imprt !== 'exports';
      }, imports);
    }
    
    return mori.list();
  }
};


module.exports = AllDependencies;