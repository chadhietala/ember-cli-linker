'use strict';

var array       = require('../utils/array');
var equal       = array.equal;
var RSVP        = require('rsvp');
var browserify  = require('browserify');
var path        = require('path');
var fs          = require('fs-extra');
var mapSeries   = require('promise-map-series');
var hashForDep  = require('hash-for-dep');
var quickTemp   = require('quick-temp');
var syncForwardDependencies = require('../utils/sync-forward-dependencies');

function generateStub(moduleName) {
  return 'define("npm:' + moduleName + '", function() {' +
         'return { "default": require("' + moduleName + '") };' +
         '});';
}

function hashesValid(pkg, parentPath, cache) {
  var newDepHashes = hashForDep(pkg, parentPath);
  return equal(cache.hash, newDepHashes);
}

module.exports = {
  cache: {},

  bundler: function(entry, basedir) {
    var b = browserify({
      basedir: basedir
    });
    b.add(entry);
    return b;
  },

  updateCache: function(stubPath, packageName, basedir, outpath) {
    return new RSVP.Promise(function(resolve, reject) {
      this.bundler(stubPath, basedir).bundle(function(err, data) {
        var file = stubPath.split('browserified')[1];
        var out = path.join(outpath, 'browserified', file);
        var tmpPath = this.tmpBrowserify + file;
        if (err) {
          reject(err);
        }

        fs.mkdirsSync(path.dirname(tmpPath));
        fs.writeFileSync(tmpPath, data);
        syncForwardDependencies(packageName, out, tmpPath);

        resolve();
      }.bind(this));
    }.bind(this));
  },

  syncNodeModules: function(parentNodeModulesPath, tmpNodeModulesPath) {
    try {
      if (!fs.existsSync(tmpNodeModulesPath)) {
        fs.symlinkSync(parentNodeModulesPath, tmpNodeModulesPath);
      }
    } catch (e) {
      // Node cannot check if a path is a symlink synchronously hence
      // the try catch.
    }

  },

  updateThroughCache: function(options) {
    var cache = options.cache;
    var stub = options.stub;
    var pkg = options.pkg;
    var parentRoot = options.parentRoot;
    var stubPath = options.stubPath;
    var destDir = options.destDir;
    var outputPath = options.outputPath;
    var file = stubPath.split('browserified')[1];

    if (!cache || cache.stub !== stub || !hashesValid(pkg, parentRoot, cache)) {
      this.cache[parentRoot] = {
        stub: stub,
        hash: hashForDep(pkg ,parentRoot)
      };

      fs.writeFileSync(stubPath, stub);

      return this.updateCache(stubPath, pkg, parentRoot, destDir).then(function() {
        fs.removeSync(path.join(parentRoot, 'browserified'));
      });
    }

    syncForwardDependencies(pkg, outputPath, this.tmpBrowserifyPath + path.sep + file);
  },

  resolveLater: function(destDir, importCache) {
    return mapSeries(Object.keys(importCache), function(pkg) {
      var parentDescriptor = importCache[pkg].parent.descriptor;
      var parentName = parentDescriptor.name;
      var imports = importCache[pkg].imports;
      var parentRoot = parentDescriptor.root;
      var cache = this.cache[parentRoot];
      var stubPath = path.join(path.resolve('tmp', 'browserified', parentName), parentName + '-legacy.js');
      var tmpNodeModulesPath = path.join(path.dirname(stubPath), 'node_modules');
      var stub = imports.map(function(imprt) {
        return generateStub(imprt.name);
      }).join('');

      quickTemp.makeOrReuse(this, 'tmpBrowserify');

      fs.mkdirsSync(path.dirname(stubPath));

      this.syncNodeModules(parentDescriptor.nodeModulesPath, tmpNodeModulesPath);
      return this.updateThroughCache({
        cache: cache,
        stub: stub,
        pkg: pkg,
        parentRoot: parentRoot,
        stubPath: stubPath,
        destDir: destDir,
        outputPath: path.join(destDir, 'browserified', parentName, parentName + '-legacy.js')
      });
    }, this);
  }
};
