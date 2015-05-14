'use strict';

var utils           = require('../utils');
var AllDependencies = require('../all-dependencies');
var getImportInfo   = utils.getImportInfo;
var fs              = require('fs-extra');
var path            = require('path');
var esperanto       = require('esperanto');
var helpers         = require('broccoli-kitchen-sink-helpers');
var hashStrings     = helpers.hashStrings;


module.exports = {
  extension: '.js',
  cache: {},

  compileThroughCache: function(source, importName) {
    var mod;
    var cache = this.cache[importName]

    if (!cache || cache.src !== source || hashStrings([source]) !== cache.hash) {
      mod = esperanto.toAmd(source, {
        amdName: importName,
        absolutePaths: true,
        strict: true
      });

      this.cache = {
        hash: hashStrings([source]),
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

  resolveImport: function(destination, nodeModulesPath, imprt, pkgInfo) {
    var imprtInfo = getImportInfo(imprt);
    var importName = imprtInfo.name;
    var file = path.sep + imprt + this.extension;
    var destinationPath = path.join(destination, file);
    var modPath = path.join(nodeModulesPath, file);
    var source = fs.readFileSync(modPath, 'utf8');
    var mod = this.compileThroughCache(source, imprt);

    this.syncForwardDependencies(destinationPath, mod.code);
    AllDependencies.add(imprtInfo.pkgName, importName, mod.deps.imports);
    return AllDependencies.for(importName, pkgInfo).imports;
  },

  resolve: function(destDir, imprtInfo, prePackager, pkgInfo) {
    var nodeModulesPath = pkgInfo.nodeModulesPath;
    var importName = imprtInfo.name;
    var nextImports = this.resolveImport(destDir, nodeModulesPath, importName, pkgInfo);
    this.materializeGraph(destDir, nodeModulesPath, nextImports, pkgInfo);
  }
};