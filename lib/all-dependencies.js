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

  for: function(fileOrPackage) {
    var parts = fileOrPackage.split('/');
    var packageName = parts[0];

    if (!this._graph[packageName]) {
      return mori.hashMap();
    }

    // for() was passed a package name
    if (this._graph[fileOrPackage]) {
      return mori.toClj(this._graph[fileOrPackage]);
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