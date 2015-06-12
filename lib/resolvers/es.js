'use strict';

var AllDependencies = require('../all-dependencies');
var fs              = require('fs-extra');
var path            = require('path');
var esperanto       = require('esperanto');
var babel           = require('babel-core');
var Descriptor      = require('../models/descriptor');
var quickTemp       = require('quick-temp');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');

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

      if (basePath) {
        mod.deps.imports = this.setBasePath(mod.deps.imports, basePath);
      }
      
      this.cache[importName] = {
        mod: mod,
        src: source
      };
      
    } else {
      mod = cache.mod;
    }

    return mod;
  },

  syncForwardDependency: function(packageName, destination, tmpPath, source, importPath) {
    fs.mkdirsSync(path.dirname(tmpPath));
    fs.writeFileSync(tmpPath, source);
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


    if (!pkg['jsnext:main']) {
      throw new Error('You attempted to resolve "' + importName + '" from the "' + packageName + '" package. To accurately resolve ES6 modules, the package must provide a "jsnext:main" key in it\'s package.json.');
    }

    if (isMain) {
      file = pkg['jsnext:main'];
      relativePath = packageName + '/' + file.replace(path.extname(file), '');
      destinationPath = path.join(destination, pkg.name, file);
      tmpPath = tmpModules + path.sep + pkg.name + path.sep + file;
      importPath = path.join(root, file);
      basePath = path.dirname(relativePath);
    } else {
      file = importName + this.extension;
      relativePath = importName;
      destinationPath = path.join(destination, file);
      tmpPath = tmpModules + path.sep + file;
      importPath = path.join(nodeModulesPath, file);
    }

    mod = this.compileThroughCache(fs.readFileSync(importPath, 'utf8'), importName, basePath);

    this.syncForwardDependency(pkg.name, destinationPath, tmpPath, mod.code, relativePath + this.extension);
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