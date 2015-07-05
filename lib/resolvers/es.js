'use strict';

var AllDependencies = require('../all-dependencies');
var fs              = require('fs-extra');
var path            = require('path');
var babel           = require('babel-core');
var Descriptor      = require('../models/descriptor');
var quickTemp       = require('quick-temp');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');
var amdNameResolver = require('amd-name-resolver');
var uniq            = require('../utils/array').uniq;
var RSVP            = require('rsvp');

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
    var cache = this.cache[importName];
    var self = this;
    if (!cache || cache.src !== source) {
      return new RSVP.Promise(function(resolve) {
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
              return amdNameResolver(moduleSource, basePath);
            }

            return amdNameResolver(moduleSource, fileName);
          }
        });

        self.cache[importName] = {
          mod: transpiled,
          src: source
        };

        resolve(transpiled);
      });
    }

    return RSVP.Promise.resolve(cache.mod);
  },

  writeSourceMap: function(destination, sourceMap) {
    destination = destination.replace(path.extname(destination), '.js.map');
    fs.mkdirsSync(path.dirname(destination));
    fs.outputJSONSync(destination, sourceMap);
  },

  syncForwardDependency: function(packageName, destination, tmpPath, mod, importPath) {
    fs.mkdirsSync(path.dirname(tmpPath));
    fs.writeFileSync(tmpPath, mod.code);
    this.writeSourceMap(destination, mod.map);
    syncForwardDependencies(packageName, destination, tmpPath, importPath);
  },

  materializeGraph: function(destination, nodeModulesPath, importPromise, packageName) {
    var self = this;
    return importPromise.then(function(imports) {
      if (imports.length === 0) {
        return;
      }

      var nextImports = [];
      var currentImports = [];

      function addToNextImports(_nextImports) {
        nextImports = nextImports.concat(_nextImports);
      }

      function materialize() {
        nextImports = RSVP.Promise.resolve(uniq(nextImports).filter(function(importName) {
          return !AllDependencies.isSynced(packageName, importName);
        }));
        return self.materializeGraph(
          destination,
          nodeModulesPath,
          nextImports,
          packageName);
      }

      imports.forEach(function(importName) {
        currentImports.push(self.resolveImport(
          destination,
          nodeModulesPath,
          packageName,
          importName).then(addToNextImports));
      });

      return RSVP.Promise.all(currentImports).then(materialize);
    });
  },

  _makeOrLookupDescriptor: function(packageName, nodeModulesPath) {
    var pack = AllDependencies.for(packageName);
    if (pack && pack.descriptor) {
      return pack.descriptor;
    }

    var root = path.join(nodeModulesPath, packageName);
    var pkg = fs.readJSONSync(path.join(root, 'package.json'));
    var importNodeModulesPath = path.join(root, 'node_modules');
    var tmpModules = quickTemp.makeOrReuse(this, 'tmpModules');

    return new Descriptor({
      root: root,
      pkg: pkg,
      srcDir: tmpModules,
      packageName: pkg.name,
      nodeModulesPath: fs.existsSync(importNodeModulesPath) ? importNodeModulesPath : null
    });
  },

  resolveImport: function(destination, nodeModulesPath, packageName, importName) {
    if (AllDependencies.isSynced(packageName, importName)) {
      return [];
    }

    var self = this;
    var descriptor = this._makeOrLookupDescriptor(packageName, nodeModulesPath);
    var pkg = descriptor.pkg;
    var root = descriptor.root;
    var isMain = packageName === importName;
    var file;
    var relativePath;
    var destinationPath;
    var importPath;
    var basePath;
    var tmpPath;

    if (!pkg['jsnext:main']) {
      throw new Error('You attempted to resolve "' + importName + '" from the "' + packageName + '" package. To accurately resolve ES6 modules, the package must provide a "jsnext:main" key in it\'s package.json.');
    }

    if (isMain) {
      file = pkg['jsnext:main'];
      relativePath = packageName + '/' + file.replace(path.extname(file), '');
      destinationPath = path.join(destination, pkg.name, file);
      tmpPath = this.tmpModules + path.sep + pkg.name + path.sep + file;
      importPath = path.join(root, file);
      basePath = path.dirname(relativePath) + path.sep;
    } else {
      file = importName + this.extension;
      relativePath = importName;
      destinationPath = path.join(destination, file);
      tmpPath = this.tmpModules + path.sep + file;
      importPath = path.join(nodeModulesPath, file);
    }

    function syncAndCollectDependencies(mod) {
      self.syncForwardDependency(
        pkg.name,
        destinationPath,
        tmpPath,
        mod,
        relativePath + self.extension);

      AllDependencies.add(descriptor, relativePath, mod.metadata.modules);
      return AllDependencies.for(relativePath, pkg.name);
    }

    return this.compileThroughCache(
      fs.readFileSync(importPath, 'utf8'),
      importName,
      basePath).then(syncAndCollectDependencies);
  },

  resolve: function(destDir, importInfo, linker) {
    var parentDescriptor = linker.treeDescriptors[importInfo.importer];
    var nodeModulesPath = parentDescriptor.nodeModulesPath;
    var importName = importInfo.name;
    var packageName = importInfo.packageName;
    var nextImports = this.resolveImport(destDir, nodeModulesPath, packageName, importName);
    return this.materializeGraph(destDir, nodeModulesPath, nextImports, packageName);
  }
};
