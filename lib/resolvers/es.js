'use strict';

var AllDependencies = require('../all-dependencies');
var fs              = require('fs-extra');
var path            = require('path');
var esperanto       = require('esperanto');
var babel           = require('babel-core');
var Descriptor      = require('../models/descriptor');

module.exports = {
  extension: '.js',
  cache: {},

  compileThroughCache: function(source, importName) {
    var mod;
    var cache = this.cache[importName];

    if (!cache || cache.src !== source) {

      var transpiled = babel.transform(source, {
        blacklist: ['es6.modules', 'useStrict'],
        nonStandard: false,
        highlightCode: false
      }).code;

      mod = esperanto.toAmd(transpiled, {
        amdName: importName,
        absolutePaths: true,
        strict: true
      });

      this.cache = {
        mod: mod,
        src: source
      };
      
    } else {
      mod = this.cache.mod;
    }

    return mod;
  },

  syncForwardDependencies: function(destination, source) {
    if (!fs.existsSync(destination)) {
      fs.mkdirsSync(path.dirname(destination));
      fs.writeFileSync(destination, source);
    }
  },

  materializeGraph: function(destination, nodeModulesPath, imports, pkgInfo) {
    imports.forEach(function(imprt) {
      var nextImports = this.resolveImport(destination, nodeModulesPath, imprt, pkgInfo);
      this.materializeGraph(destination, nodeModulesPath, nextImports, pkgInfo);
    }, this);
  },

  resolveImport: function(destination, nodeModulesPath, packageName, importName) {
    var root = path.join(nodeModulesPath, packageName);
    var pkg = require(path.join(root, 'package.json'));
    var importNodeModulesPath = path.join(root, 'node_modules');
    var descriptor = new Descriptor({
      root: root,
      pkg: pkg,
      name: pkg.name,
      nodeModulesPath: fs.existsSync(importNodeModulesPath) ? importNodeModulesPath : null
    });
    var file;
    var relativePath;
    var destinationPath;
    var importPath;
    var mod;

    if (packageName === importName) {
      file = pkg.main;
      relativePath = packageName + '/' + file.replace(path.extname(file), '');
      destinationPath = path.join(destination, pkg.name, file);
    } else {
      file = importName + this.extension;
      relativePath = importName;
      destinationPath = path.join(destination, file);
    }
    
    importPath = path.join(root, file);
    mod = this.compileThroughCache(fs.readFileSync(importPath, 'utf8'), importName);

    this.syncForwardDependencies(destinationPath, mod.code);
    AllDependencies.add(descriptor, relativePath, mod.deps);
    return AllDependencies.for(relativePath, pkg.name);
  },

  resolve: function(destDir, importInfo, prePackager) {
    var parentDescriptor = prePackager.treeDescriptors[importInfo.importer];
    var nodeModulesPath = parentDescriptor.nodeModulesPath;
    var importName = importInfo.name;
    var packageName = importInfo.pkgName;
    var nextImports = this.resolveImport(destDir, nodeModulesPath, packageName, importName);
    this.materializeGraph(destDir, nodeModulesPath, nextImports);
  }
};