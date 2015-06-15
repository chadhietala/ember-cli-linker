'use strict';

var AllDependencies = require('../all-dependencies');
var fs              = require('fs-extra');
var path            = require('path');
var babel           = require('babel-core');
var Descriptor      = require('../models/descriptor');
var quickTemp       = require('quick-temp');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');

function mungeMetaData(metadata) {
  return {
    imports: metadata.imports.map(function(importInfo) {
      return importInfo.source;
    })
  };
}


function moduleResolve(child, name) {
  if (child.charAt(0) !== '.') { return child; }

  var parts = child.split('/');
  var nameParts = name.split('/');
  var parentBase = nameParts.slice(0, -1);

  for (var i = 0, l = parts.length; i < l; i++) {
    var part = parts[i];

    if (part === '..') {
      if (parentBase.length === 0) {
        throw new Error('Cannot access parent module of root');
      }
      parentBase.pop();
    } else if (part === '.') {
      
      continue;
    } else { parentBase.push(part); }
  }

  return parentBase.join('/');
}

module.exports = {
  extension: '.js',
  cache: {},

  setBasePath: function(imports, basePath) {
    return imports.filter(function(imprt) {
      return imprt !== 'exports';
    }).map(function(imprt) {
      return basePath + '/' + imprt;
    });
  },

  compileThroughCache: function(source, importName, basePath) {
    var mod = {};
    var cache = this.cache[importName];
    if (!cache || cache.src !== source) {

      var transpiled = babel.transform(source, {
        modules: 'amd',
        moduleIds: true,
        moduleId: importName,
        filename: importName,
        nonStandard: false,
        highlightCode: false,
        sourceMaps: true,
        resolveModuleSource: function(moduleSource, fileName) {
          
          if (basePath) {
            return moduleResolve(moduleSource, basePath);
          }

          return moduleResolve(moduleSource, fileName);
        }
      });

      // TODO 
      // We need to munge this into what esperanto used to give us
      // In the future we need to refactor when the builder is passing us
      // dep-graph.json from babel.
      mod.deps = mungeMetaData(transpiled.metadata.modules);
      mod.code = transpiled.code;
      mod.map = transpiled.map;
      
      this.cache[importName] = {
        mod: mod,
        src: source
      };
      
    } else {
      mod = cache.mod;
    }

    return mod;
  },

  writeSourceMap: function(destination, sourceMap) {
    destination = destination.replace(path.extname(destination), '.map');
    fs.mkdirsSync(path.dirname(destination));
    fs.writeFileSync(destination, sourceMap);
  },

  syncForwardDependency: function(packageName, destination, tmpPath, mod, importPath) {
    fs.mkdirsSync(path.dirname(tmpPath));
    fs.writeFileSync(tmpPath, mod.code);
    this.writeSourceMap(destination, mod.map);
    syncForwardDependencies(packageName, destination, tmpPath, importPath);
  },

  materializeGraph: function(destination, nodeModulesPath, imports, packageName) {
    imports.forEach(function(imprtName) {
      var nextImports = this.resolveImport(destination, nodeModulesPath, packageName, imprtName);
      this.materializeGraph(destination, nodeModulesPath, nextImports, packageName);
    }, this);
  },

  resolveImport: function(destination, nodeModulesPath, packageName, importName) {
    var root = path.join(nodeModulesPath, packageName);
    var pkg = fs.readJSONSync(path.join(root, 'package.json'));
    var importNodeModulesPath = path.join(root, 'node_modules');
    var tmpModules = quickTemp.makeOrReuse(this, 'tmpModules');
    var descriptor = new Descriptor({
      root: root,
      pkg: pkg,
      srcDir: tmpModules,
      packageName: pkg.name,
      nodeModulesPath: fs.existsSync(importNodeModulesPath) ? importNodeModulesPath : null
    });
    var isMain = packageName === importName;
    var file;
    var relativePath;
    var destinationPath;
    var importPath;
    var mod;
    var basePath;
    var tmpPath;

    if (isMain) {
      file = pkg['jsnext:main'] || pkg.main;
      relativePath = packageName + '/' + file.replace(path.extname(file), '');
      destinationPath = path.join(destination, pkg.name, file);
      tmpPath = tmpModules + path.sep + pkg.name + path.sep + file;
      importPath = path.join(root, file);
      basePath = path.dirname(relativePath) + path.sep;
    } else {
      file = importName + this.extension;
      relativePath = importName;
      destinationPath = path.join(destination, file);
      tmpPath = tmpModules + path.sep + file;
      importPath = path.join(nodeModulesPath, file);
    }

    mod = this.compileThroughCache(fs.readFileSync(importPath, 'utf8'), importName, basePath);

    this.syncForwardDependency(pkg.name, destinationPath, tmpPath, mod, relativePath + this.extension);
    AllDependencies.add(descriptor, relativePath, mod.deps);
    return AllDependencies.for(relativePath, pkg.name);
  },

  resolve: function(destDir, importInfo, prePackager) {
    var parentDescriptor = prePackager.treeDescriptors[importInfo.importer];
    var nodeModulesPath = parentDescriptor.nodeModulesPath;
    var importName = importInfo.name;
    var packageName = importInfo.packageName;
    var nextImports = this.resolveImport(destDir, nodeModulesPath, packageName, importName);
    this.materializeGraph(destDir, nodeModulesPath, nextImports, packageName);
  }
};