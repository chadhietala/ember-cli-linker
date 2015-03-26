'use strict';

var AllDependencies = {
  _graph: {},
  update: function(entry, dependencies) {
    this._graph[entry] = dependencies;
  },
  for: function(fileOrPackage) {
    var parts = fileOrPackage.split('/');
    var packageName = parts[0];
    var file;

    if (!this._graph[packageName]) {
      return null;
    }

    // for() was passed a package name
    if (this._graph[packageName]) {
      return this._graph[packageName];
    }

    // for() was passed a file path
    file = fileOrPackage;
    return this._graph[packageName][file].imports;

  }
};


module.exports = AllDependencies;