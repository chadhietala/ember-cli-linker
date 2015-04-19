'use strict';

var getImportInfo = require('./utils').getImportInfo;
var path = require('path');
var resolve = require('resolve').sync;


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

  _resolvePackage: function(packageName, basedir) {
    var mainFile = resolve(packageName, { basedir: basedir });
    var splitter = 'node_modules/' + packageName + '/';
    var splitterIndex = mainFile.indexOf(splitter) + splitter.length;
    return mainFile.substring(0, splitterIndex);  
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
      var parts = process.cwd().split(path.sep);
      var pkg = parts[parts.length - 1];
      var importInfo = {
        pkg: packageName,
        pkgPath: null
      };

      if (graph[fileOrPackage]) {
        // node with deps
        if (pkg === packageName) {
          importInfo.pkgPath = process.cwd();
        } else {
          importInfo.pkgPath = this._resolvePackage(fileOrPackage, parent);
        }

        importInfo.imports = graph[fileOrPackage];
        return importInfo;

      } else if (fileOrPackage.indexOf(entry) > -1){
        // leaf node
        importInfo.pkgPath = process.cwd();
        importInfo.imports = [];
        return importInfo;

      } else {
        var mainFile = resolve(packageName, { basedir: entry });
        var index = mainFile.indexOf(fileOrPackage);
        var splitter = 'node_modules/' + packageName + '/';
        var splitterIndex = mainFile.indexOf(splitter) + splitter.length;
        var isMain = (mainFile.substr(index, mainFile.length) === fileOrPackage);

        if (isMain) {
          importInfo.imports = graph[packageName];
        } else {
          importInfo.imports = graph[fileOrPackage];
        }

        importInfo.pkgPath = mainFile.substring(0, splitterIndex);
        return importInfo;
      }
    }


    // for() was passed a file path
    if (graph && graph[fileOrPackage]) {
      var parts = process.cwd().split(path.sep);
      var pkg = parts[parts.length - 1];
      var pkgPath;

      if (pkg === packageName) {
        pkgPath = process.cwd();
      }

      return {
        pkg: packageName,
        pkgPath: pkgPath,
        fileImports: graph[fileOrPackage]
      };
    }


    var mainFile = resolve(packageName, { basedir: parent });
    var index = mainFile.indexOf(fileOrPackage);
    var isMain = false;

    if (index > -1) {
      isMain = (mainFile.substr(index, mainFile.length) === fileOrPackage);
    }

    if (isMain) {
      var splitter = 'node_modules/' + packageName + '/';
      var splitterIndex = mainFile.indexOf(splitter) + splitter.length;

      return {
        pkgPath: mainFile.substring(0, splitterIndex),
        imports: graph[packageName]
      };
    }

    return {};
  }
};


module.exports = AllDependencies;
