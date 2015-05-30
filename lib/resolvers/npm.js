'use strict';

var array       = require('../utils/array');
var equal       = array.equal;
var RSVP        = require('rsvp');
var browserify  = require('browserify');
var path        = require('path');
var fs          = require('fs-extra');
var mapSeries   = require('promise-map-series');
var hashForDep   = require('hash-for-dep');

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

  updateCache: function(entryFile, basedir, outpath) {
    return new RSVP.Promise(function(resolve, reject) {
      this.bundler(entryFile, basedir).bundle(function(err, data) {
        var out = path.join(outpath, 'browserified', entryFile.split('browserified')[1]);
        if (err) {
          reject(err);
        }

        fs.mkdirsSync(path.dirname(out));
        fs.writeFileSync(out, data);

        this.cache[basedir].buffer = data;

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
    var outFile = options.outFile;
    var destDir = options.destDir;

    if (!cache || cache.stub !== stub || !hashesValid(pkg, parentRoot, cache)) {
      this.cache[parentRoot] = {
        stub: stub,
        hash: hashForDep(pkg ,parentRoot)
      };

      fs.writeFileSync(outFile, stub);

      return this.updateCache(outFile, parentRoot, destDir).then(function() {
        fs.removeSync(path.join(parentRoot, 'browserified'));
      });
    }

    fs.writeFileSync(outFile, cache.buffer);
  },

  resolveLater: function(destDir, importCache) {
    return mapSeries(Object.keys(importCache), function(pkg) {
      var parentDescriptor = importCache[pkg].parent.descriptor;
      var parentName = parentDescriptor.name;
      var imports = importCache[pkg].imports;
      var parentRoot = parentDescriptor.root;
      var cache = this.cache[parentRoot];
      var outFile = path.join(path.resolve('tmp', 'browserified', parentName), parentName + '-legacy.js');
      var tmpNodeModulesPath = path.join(path.dirname(outFile), 'node_modules');
      var stub = imports.map(function(imprt) {
        return generateStub(imprt.name);
      }).join('');

      fs.mkdirsSync(path.dirname(outFile));

      this.syncNodeModules(parentDescriptor.nodeModulesPath, tmpNodeModulesPath);
      return this.updateThroughCache({
        cache: cache,
        stub: stub,
        pkg: pkg,
        parentRoot: parentRoot,
        outFile: outFile,
        destDir: destDir
      });
    }, this);
  }
};
