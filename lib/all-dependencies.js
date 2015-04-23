'use strict';

var utils = require('./utils');
var getImportInfo = utils.getImportInfo;
var resolvePackage = utils.resolvePackage;
var resolve = require('resolve').sync;
var path = require('path');
var debug = require('debug');

function node(packageName, imports, pkgInfo) {
  var name  = require(process.cwd() + '/package.json').name;
  var parent = pkgInfo.parent;

  if (name === packageName) {
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

    // Today last one wins... tomorrow something else.
    var deps = {};
    Object.keys(dependencies).forEach(function(file) {
      var fileName = file.replace(/\.js$/, '');
      
      var dependency = dependencies[file];
      var imports = dependency.imports.slice();

      var exportsIndex = imports.indexOf('exports');
      if (exportsIndex > -1) {
        imports.splice(exportsIndex, 1);
      }
      deps[fileName] = imports;
    });

    debug('ember-cli-pre-packager:' + entry)('updating with with %o', deps);
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