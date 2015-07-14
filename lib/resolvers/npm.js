'use strict';

var array                   = require('../utils/array');
var equal                   = array.equal;
var RSVP                    = require('rsvp');
var browserify              = require('browserify');
var path                    = require('path');
var fs                      = require('fs-extra');
var hashForDep              = require('hash-for-dep');
var quickTemp               = require('quick-temp');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');
var AllDependencies         = require('../all-dependencies');
var resolveNodeModulePath   = require('node-modules-path');
var existsSync              = require('exists-sync');
var getPackageName          = require('../models/package').getName;
var flatten                 = array.flatten;
var head                    = array.head;
var symlinkOrCopySync       = require('symlink-or-copy').sync;
var uniq                    = array.uniq;

function generateStub(moduleName) {
  return 'define("npm:' + moduleName + '", function() {' +
         'return { "default": require("' + moduleName + '") };' +
         '});';
}

module.exports = {
  cache: {},
  /**
   * Creates a new browserify instance in add the file to it.
   * @param  {String} file The file we are to browserify
   * @return {Object}      The browserify instance
   */
  bundler: function(file) {
    var b = browserify();
    b.add(file);
    return b;
  },

  /**
   * Validates new hashes against the current hashes.
   * @param  {Object} currentHashes Hashes keyed off of the package name
   * @param  {Array} packageNames  The package names we are generating hashes for
   * @return {Boolean}
   */
  hashesValid: function(currentHashes, packageNames) {
    var currentPackageNames = Object.keys(currentHashes);
    var packagesEqual = equal(packageNames, currentPackageNames);

    if (!packagesEqual) {
      return packagesEqual;
    }

    var newHashes = this.hashPackages(packageNames);

    packageNames.forEach(function(packageName) {
      return newHashes[packageName] = hashForDep(packageName, this.browserifyStaging);
    }, this);

    return packageNames.every(function(packageName) {
      return newHashes[packageName] === currentHashes[packageName];
    });
  },

  /**
   * Compiles the stub file which results in pulling in any of the npm: modules
   * @param  {String} stubPath The path to where the stubs file is writen
   * @return {Promise}          Contains the browserified package
   */
  compile: function(stubPath) {
    return new RSVP.Promise(function(resolve, reject) {
      this.bundler(stubPath).bundle(function(err, data) {
        if (err) {
          reject(err);
        }

        fs.writeFileSync(this.browserifiedPath, data);
        resolve();
      }.bind(this));
    }.bind(this));
  },

  syncNodeModules: function(nodeModulePaths) {
    var stagingNodeModules = path.join(this.browserifyStaging, 'node_modules');
    fs.mkdirsSync(stagingNodeModules);
    uniq(nodeModulePaths).forEach(function(dirPath) {
      var parts = dirPath.split('/');
      var moduleName = parts[parts.length - 1];
      var stagingPath = path.join(stagingNodeModules, moduleName);

      if (!existsSync(stagingPath)) {
        symlinkOrCopySync(dirPath, stagingPath);
      }
    });
  },

  /**
   * Hashes the packages in the staging
   * @param  {Array} packageNames The packages in staging
   * @return {Object}              An object containing hashes
   */
  hashPackages: function(packageNames) {
    var hashes = {};
    packageNames.forEach(function(packageName) {
      // Make sure we are dealing with that package name and not file in the package
      packageName = getPackageName(packageName);
      hashes[packageName] = hashForDep(packageName, this.browserifyStaging);
    }, this);
    return hashes;
  },

  /**
   * Browserifies the stub through a cache so that work is only ever
   * preformed when the imports change
   * @param  {Object} options
   * @property {String} options.stub The generated stub
   * @property {Array} options.stub The packages in the stub
   * @property {Array} options.imports  The imports representing in the stub
   * @return {Promise|Nil} Either a promise that writes the file to disk or nil
   */
  compileThroughCache: function(options) {
    var stub = options.stub;
    var packageNames = options.packageNames;
    var imports = options.imports;
    var cache = this.cache;
    var stubPath = path.join(this.browserifyStaging, 'browserfiy-stub.js');

    if (!cache.stub || cache.stub !== stub || !this.hashesValid(cache.hashes, packageNames)) {
      this.writeStubFile(stubPath, stub);

      this.cache = {
        stub: stub,
        hashes: this.hashPackages(packageNames)
      };

      return this.compile(stubPath).then(function() {
        imports.forEach(function(importName) {
          AllDependencies.sync(importName, [this.bundleName], {
            source: this.browserifiedPath,
            destination: this.destination,
            relativePath: this.bundleName + '.js',
            packageName: importName
          });
        }, this);

        this.sync();

      }.bind(this));
    }

    this.sync();
  },

  /**
   * Syncs the stub file and places it into the graph
   * @return {Nil}
   */
  sync: function() {
    syncForwardDependencies({
      destination: this.destination,
      source: this.browserifiedPath,
      node: {
        tail: this.bundleName
      },
      meta: {
        packageName: 'browserify',
        isBundle: true
      }
    });
  },

  /**
   * Creates the contents of the stub file
   * @param  {Array} imports Array of imports
   * @return {String}       An AMD stub
   */
  createStub: function(imports) {
    return imports.map(function(imprt) {
      var name = this.createAnnotatedMapping(imprt)[1];
      return generateStub(name);
    }, this).join('\n');
  },

  /**
   * Creates a mapping from npm:<importName> to <importName>.
   *
   * @example
   *
   * createAnnotatedMapping('npm:jquery') -> ['npm:jquery', 'jquery']
   *
   * @param  {String} annotatedImport An import prefixed with npm:
   * @return {Array}                 A pair contain the mapping
   */
  createAnnotatedMapping: function(annotatedImport) {
    var importName = head([annotatedImport].map(this.byPackageName));
    return [annotatedImport, importName];
  },

  /**
   * Resolves an imports path using node's require.resolve method
   * @param  {String} importName      The name of the import we are resolving
   * @param  {String} nodeModulesPath The node module path to resolve from
   * @return {String}                 The resolved path
   */
  _resolveImportPath: function(importName, nodeModulesPath)  {
    var importPath = path.join(nodeModulesPath, importName);
    return require.resolve(importPath);
  },

  /**
   * Gets the base directory for a module
   * @param  {String} modulePath The path to the module
   * @param  {String} moduleName The modules name
   * @return {String}            The path at the base directory
   */
  _moduleBaseDir: function(modulePath, moduleName) {
    var segment = 'node_modules/' + moduleName;
    return modulePath.replace(new RegExp(segment + '.*$'), segment).replace(/index\.js\/?$/, '');
  },

  /**
   * Recursivly gathers the base directories of a packages dependencies
   * @param  {Array} basedirs An array of root base directories
   * @return {Array}          The base dirs for all of the roots dependencies
   */
  _gatherModuleBaseDirs: function(basedirs, packageNames) {
    return basedirs.map(function(basedir, i) {
      // Need to verify we have the basedir in recursive walks
      basedir = this._moduleBaseDir(basedir, packageNames[i]);

      var pkg = fs.readJSONSync(path.join(basedir, 'package.json'));

      if (pkg.dependencies) {
        var deps = Object.keys(pkg.dependencies);
        var newBaseDirs = this._concretePaths(deps, basedir);
        return this._gatherModuleBaseDirs(newBaseDirs, deps);
      }

      return basedir;

    }, this);

  },

  /**
   * Verfies the paths for deps of a root. This supports both a nested and
   * flattend node_modules directory.
   * @param  {Array} deps    Dependencies we would like to validate
   * @param  {[type]} basedir Used to resolve the node module path
   * @return {Array}         The verfied paths for deps
   */
  _concretePaths: function(deps, basedir) {
    var nodeModulesPath = resolveNodeModulePath(basedir);
    return deps.map(function(dep) {
      var sibling = path.join(nodeModulesPath, dep);
      var child = path.join(nodeModulesPath, 'node_modules', dep);
      if (existsSync(sibling)) {
        return sibling;
      } else if (existsSync(child)) {
        return child;
      } else {
        throw new Error('Cannot resolve node_modules path for ' + dep + '.');
      }
    });
  },

  /**
   * Removes the npm: annotation
   * @param  {String} importName The annotated import
   * @return {String}            The striped import
   */
  byPackageName: function(importName) {
    var moduleName = importName.split('npm:')[1];
    return moduleName;
  },

  /**
   * Writes the stub file
   * @param  {String} stubPath where we will write the stub file
   * @param  {String} stub     The contents of the stub file
   * @return {Nil}
   */
  writeStubFile: function(stubPath, stub) {
    fs.writeFileSync(stubPath, stub);
  },

  /**
   * Collects the module directories that can be synced to staging
   * @param  {Array} dependentEdges The edges into the npm: files
   * @param  {Object} descriptors    The tree descriptors passed into the linker
   * @return {Array}                The module directories
   */
  moduleDirs: function(dependentEdges, descriptors) {
    var moduleBaseDirs = dependentEdges.map(function(edge) {
      var packageName = AllDependencies.getNodeMeta(edge.v).packageName;
      var parentNodeModulesPath = descriptors[packageName].nodeModulesPath;
      var importName = this.createAnnotatedMapping(edge.w)[1];
      var resolvedPath = this._resolveImportPath(importName, parentNodeModulesPath);
      return this._moduleBaseDir(resolvedPath, packageName);
    }, this);

    var packageNames = dependentEdges.map(function(edge) {
      return AllDependencies.getNodeMeta(edge.v).packageName;
    });

    return flatten(this._gatherModuleBaseDirs(moduleBaseDirs, packageNames)).concat(moduleBaseDirs);
  },
  /**
   * Resolves common JS modules using browserify. Crates a single bundle containing
   * all common JS modules inside the application. It also the attaches the npm:
   * imports to the browserify bundle inside of the graph.
   * @param  {String} destDir     The destination temp directory setup by broccoli
   * @param  {Object} descriptors The tree descriptors passed to the linker
   * @return {Promise}            The bundled common js modules
   */
  resolveLater: function(destDir, descriptors) {
    this.bundleName = 'browserified-bundle';
    this.destination = path.join(destDir, this.bundleName + '.js');
    var npmNodes = AllDependencies.byType('npm');
    var stub = this.createStub(npmNodes);
    var dependentEdges = flatten(npmNodes.map(function(node) {
      return AllDependencies.getInwardEdges(node);
    }));

    quickTemp.makeOrReuse(this, 'tmpBrowserify');
    quickTemp.makeOrReuse(this, 'browserifyStaging');
    this.browserifiedPath = path.join(this.tmpBrowserify, this.bundleName);
    this.syncNodeModules(this.moduleDirs(dependentEdges, descriptors));

    return this.compileThroughCache({
      stub: stub,
      imports: npmNodes,
      packageNames: uniq(npmNodes.map(this.byPackageName))
    });
  }
};
