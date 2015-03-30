'use strict';

var Immutable = require('immutable');

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
      return Immutable.Map();
    }

    // for() was passed a package name
    if (this._graph[fileOrPackage]) {
      return Immutable.fromJS(this._graph[fileOrPackage]);
    }

    // for() was passed a file path
    if (this._graph[packageName][fileOrPackage]) {
      return Immutable.fromJS(this._graph[packageName][fileOrPackage].imports).filter(function(imprt) {
        return imprt !== 'exports';
      });
    }
    
    return Immutable.List();
  }
};


module.exports = AllDependencies;