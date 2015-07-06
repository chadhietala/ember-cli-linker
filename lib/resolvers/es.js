'use strict';

var AllDependencies = require('../all-dependencies');
var fs              = require('fs-extra');
var path            = require('path');
var babel           = require('babel-core');
var Descriptor      = require('../models/descriptor');
var Import          = require('../models/import');
var quickTemp       = require('quick-temp');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');
var amdNameResolver = require('amd-name-resolver');
var RSVP            = require('rsvp');
var existsSync      = require('exists-sync');

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

  _writeToTmp: function(mod, tmpPath, destination) {
    fs.mkdirsSync(path.dirname(tmpPath));
    fs.writeFileSync(tmpPath, mod.code);
    this.writeSourceMap(destination, mod.map);
  },

  /**
   * Recursivly resolves the dependency graph an ES2015 package
   * @param  {Promise} importPromise   A promise contain an import's imports
   * @param  {Sting} nodeModulesPath The base node modules path for the package
   * @param  {String} packageName     The package that is being resolved
   * @return {Promise}                A promise containing the next imports and the previous import
   */
  materializeGraph: function(importPromise, nodeModulesPath, packageName) {
    var self = this;

    return importPromise.then(function(_imports) {
      var imports = _imports.nextImports;

      if (imports.length === 0) {
        return;
      }

      var nextImports = [];
      var currentImports = [];

      function addToNextImports(_nextImports) {
        nextImports = nextImports.concat(_nextImports);
      }

      function materialize() {
        var promises = nextImports.map(function(item) {
          return self.materializeGraph(RSVP.resolve(item), nodeModulesPath,packageName);
        });

        return RSVP.Promise.all(promises);
      }

      imports.forEach(function(importName) {
        var p = self.resolveImport(
          nodeModulesPath,
          packageName,
          importName,
          _imports.importer
        ).then(addToNextImports);

        currentImports.push(p);
      });

      return RSVP.Promise.all(currentImports).then(materialize);
    });
  },

  /**
   * Creates a new descriptor object or looks it up from the cache
   * @param  {String} packageName     The name of the package
   * @param  {String} nodeModulesPath The path import's node_modules directory
   * @return {Object}                 The descriptor object
   */
  _makeOrLookupDescriptor: function(packageName, nodeModulesPath) {
    var pack = AllDependencies.for(packageName);
    if (pack && pack.descriptor) {
      return pack.descriptor;
    }

    var root = path.join(nodeModulesPath, packageName);

    if (!existsSync(root)) {
      throw new Error('The package ' + packageName + ' does not exist.');
    }

    var pkg = fs.readJSONSync(path.join(root, 'package.json'));
    var importNodeModulesPath = path.join(root, 'node_modules');
    var tmpModules = quickTemp.makeOrReuse(this, 'tmpModules');

    return new Descriptor({
      root: root,
      pkg: pkg,
      srcDir: tmpModules,
      packageName: pkg.name,
      nodeModulesPath: existsSync(importNodeModulesPath) ? importNodeModulesPath : null
    });
  },

  /**
   * Ensures that the import's paths are true concrete paths and then tranpiles the import through a cache object.
   * @param  {String} nodeModulesPath The node_modules path to the import
   * @param  {String} packageName     The package name in node_modules
   * @param  {String} importName      The name of the import
   * @param  {String} importer        The importer of the import that is being resolved
   * @return {Promise}                A promise containing the next imports to resolve and the importer (head node on the edge)
   */
  resolveImport: function(nodeModulesPath, packageName, importName, importer) {
    if (AllDependencies.isSynced(importName)) {
      return [];
    }

    var self = this;
    var destination = this.destination;
    var descriptor = this._makeOrLookupDescriptor(packageName, nodeModulesPath);
    var pkg = descriptor.pkg;
    var relativePath;
    var destinationPath;
    var importPath;
    var basePath;
    var tmpPath;
    var mainMapping;

    if (!pkg['jsnext:main']) {
      throw new Error('You attempted to resolve "' + importName + '" from the "' + packageName + '" package. To accurately resolve ES6 modules, the package must provide a "jsnext:main" key in it\'s package.json.');
    }

    var concreateImportPaths = Import.getConcretePaths({
      pkg: pkg,
      file: importName,
      destination: destination,
      tmpRoot: this.tmpModules,
      ext: this.extension,
      nodeModulesPath: nodeModulesPath
    });

    relativePath = concreateImportPaths.relativePath;
    destinationPath = concreateImportPaths.destinationPath;
    importPath = concreateImportPaths.importPath;
    tmpPath = concreateImportPaths.tmpPath;
    basePath = concreateImportPaths.basePath;
    mainMapping = concreateImportPaths.mainMapping;

    return this.compileThroughCache(
      fs.readFileSync(importPath, 'utf8'),
      importName,
      basePath
    ).then(function(mod) {
      self._writeToTmp(mod, tmpPath, self.destination);

      syncForwardDependencies({
        destination: destinationPath,
        source: tmpPath
      });

      AllDependencies.graph.setEdge(importer, relativePath);

      AllDependencies.graph.setNode(relativePath, {
        source: tmpPath,
        destination: destinationPath,
        mainMapping: mainMapping,
        relativePath: relativePath + self.extension,
        packageName: packageName,
        type: 'es'
      });

      AllDependencies.add(descriptor, relativePath, mod.metadata.modules);

      return {
        nextImports: AllDependencies.for(relativePath, packageName),
        importer: importName
      };
    });
  },

  /**
   * Called by the linker to resolve ES2015 imports
   * @param  {String} destDir    The output directory that was setup by Broccoli
   * @param  {Object} importInfo Import info about the entry root ES2015 import
   * @param  {Object} linker     An instance of the linker
   * @return {Promise}           Results in the ES2015 import's subgraph being built
   */
  resolve: function(destDir, importInfo, linker) {
    this.destination = destDir;
    var parentDescriptor = linker.treeDescriptors[importInfo.importerPackageName];
    var nodeModulesPath = parentDescriptor.nodeModulesPath;
    var importName = importInfo.importName;
    var packageName = importInfo.packageName;
    var importer = importInfo.importer;
    var nextImports = this.resolveImport(nodeModulesPath, packageName, importName, importer);
    return this.materializeGraph(nextImports, nodeModulesPath, packageName);
  }
};
