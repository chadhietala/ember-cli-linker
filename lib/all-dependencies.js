'use strict';

var AllDependencies = {
  _graph: {},
  update: function(entry, dependencies) {
    this._graph[entry] = dependencies;
  },
  for: function(fileOrPackage) {
    var parts = fileOrPackage.split('/');
    var packageName = parts[0];

    if (!this._graph[packageName]) {
      return null;
    }

    // for() was passed a package name
    if (this._graph[fileOrPackage]) {
      return this._graph[fileOrPackage];
    }

    // for() was passed a file path
    return this._graph[packageName][fileOrPackage].imports;

  }
};


module.exports = AllDependencies;