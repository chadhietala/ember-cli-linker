'use strict';

var utils         = require('./utils');
var nodes         = require('./nodes');
var debug         = require('debug');
var node          = nodes.node;
var leafNode      = nodes.leafNode;
var getImportInfo = utils.getImportInfo;

function removeExports(imports) {
  var exportsIndex = imports.indexOf('exports');
  if (exportsIndex > -1) {
    imports.splice(exportsIndex, 1);
  }
}

var AllDependencies = {
  _graph: {},
  _merged: {},

  mergedInto: function(entry) {
    return this._merged[entry];
  },

  mergeImports: function(to /*...from*/) {
    var from = [];

    for (var i = 1, l = arguments.length; i < l; i++) {
      from.push(arguments[i]);
    }

    var toGraph = this._graph[to];

    from.forEach(function(entry) {
      var merged = this.mergedInto(entry);
      if (!merged) {
        this._merged[entry] = to;
        Object.keys(this._graph[entry]).forEach(function(file) {
          toGraph[file] = this._graph[entry][file];
        }, this);
      } else if (merged !== to) {
        throw new Error('You attempted to merge ' + entry + ' into ' + to + ', but is already merged with ' + merged + '.');
      }
    }, this);
    
  },

  add: function(entry, dependency, imports) {
    removeExports(imports);
    if (!this._graph[entry]) {
      this._graph[entry] = {};
      this._graph[entry][dependency] = imports;
    } else  {
      this._graph[entry][dependency] = imports;
    }
  },

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
    var pkgName = infos.pkgName;
    var graph = this._graph[pkgName];
    var entry;
    var pkgInfo = {
      pkgName: pkgName,
      pkgPath: null,
      parent: parent
    };

    if (parent) {
      entry = parent.pkgName;
    }

    if (fileOrPackage.split('/').length === 1) {
      return this._graph[fileOrPackage] || {};
    }

    if (graph) {
      if (graph[fileOrPackage]) {
        return node(pkgName, graph[fileOrPackage], pkgInfo, this.mergedInto(pkgName));
      } else if (fileOrPackage.indexOf(entry) > -1) {
        return leafNode(pkgInfo);
      }
    }

    return {};
  }
};

module.exports = AllDependencies;