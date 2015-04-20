'use strict';

var utils = require('./utils');
var getImportInfo = utils.getImportInfo;
var resolvePackage = utils.resolvePackage;
var path = require('path');
var resolve = require('resolve').sync;

function node(packageName, imports, pkgInfo) {
  var parts = process.cwd().split(path.sep);
  var pkg = parts[parts.length - 1];
  var parent = pkgInfo.parent;

  if (pkg === packageName) {
    pkgInfo.pkgPath = process.cwd();
  } else {
    pkgInfo.pkgPath = resolvePackage(packageName, parent.pkgPath);
  }

  pkgInfo.entry = packageName;
  pkgInfo.imports = imports;
  return pkgInfo;
}

function leafNode(pkgInfo) {
  pkgInfo.pkgPath = process.cwd();
  pkgInfo.imports = [];
  pkgInfo.entry = pkgInfo.parent.entry;
  return pkgInfo;
}

function foreignNode(packageName, graph, file, pkgInfo) {
  var entry = pkgInfo.parent.entry;
  var mainFile = resolve(packageName, { basedir: entry });
  var index = mainFile.indexOf(file);
  var isMain = (mainFile.substr(index, mainFile.length).replace('.js', '') === file);

  if (isMain) {
    pkgInfo.imports = graph[packageName];
  } else {
    pkgInfo.imports = graph[file];
  }

  pkgInfo.entry = entry;
  pkgInfo.pkgPath = resolvePackage(packageName, entry);
  return pkgInfo;
}


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
  for: function(fileOrPackage, parent) {
    var infos = getImportInfo(fileOrPackage);
    var packageName = infos.pkg;
    var graph = this._graph[packageName];
    var pkgInfo = {
      pkg: packageName,
      pkgPath: null,
      parent: parent
    };

    var entry;

    if (parent) {
      entry = parent.entry;
    }

    if (fileOrPackage.split('/').length === 1) {
      var deps = this._graph[fileOrPackage];

      // for() was passed a package name
      if (deps) {
        return deps;
      }

      return {};
    }

    if (graph) {
      if (graph[fileOrPackage]) {
        return node(packageName, graph[fileOrPackage], pkgInfo);
      } else if (fileOrPackage.indexOf(entry) > -1){
        return leafNode(pkgInfo);
      } else {
        return foreignNode(packageName, graph, fileOrPackage, pkgInfo);
      }
    }

    return {};
  }
};


module.exports = AllDependencies;
