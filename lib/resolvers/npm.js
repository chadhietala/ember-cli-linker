'use strict';

var utils       = require('../utils');
var arraysEqual = utils.arraysEqual;
var RSVP        = require('rsvp');
var browserify  = require('browserify');
var path        = require('path');
var fs          = require('fs-extra');
var mapSeries   = require('promise-map-series');
var hasForDep   = require('hash-for-dep');

function generateStub(moduleName) {
  return 'define("npm:' + moduleName + '", function() {' +
         'return { "default": require("' + moduleName + '") };' +
         '});';
}

function hashDeps(imports, fullPath) {
  return imports.map(function(imprt) {
    imprt = imprt.replace('npm:', '');

    return utils.getImportInfo(imprt).pkg;
  }).reduce(function(a, b) {
    if (a.indexOf(b) < 0) {
      a.push(b);
    }
    return a;
  }, []).map(function(dep) {
    return hasForDep(dep, fullPath);
  });
}

function hashesValid(imports, fullPath, cache) {
  var newDepHashes = hashDeps(imports, fullPath);
  return arraysEqual(cache.hashes, newDepHashes);
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

  syncNodeModules: function(parentPath, nodeModulesPath) {
    if (!fs.existsSync(nodeModulesPath)) {
      fs.symlinkSync(path.join(parentPath, 'node_modules'), nodeModulesPath);
    }
  },

  updateThroughCache: function(options) {
    var cache = options.cache;
    var stub = options.stub;
    var imports = options.imports;
    var parentPath = options.parentPath;
    var outFile = options.outFile;
    var destDir = options.destDir;

    if (!cache || cache.stub !== stub || !hashesValid(imports, parentPath, cache)) {
      this.cache[parentPath] = {
        stub: stub,
        hashes: hashDeps(imports, parentPath)
      };

      fs.writeFileSync(outFile, stub);

      return this.updateCache(outFile, parentPath, destDir).then(function() {
        fs.removeSync(path.join(parentPath, 'browserified'));
      });
    }

    fs.writeFileSync(outFile, cache.buffer);
  },

  resolveLater: function(destDir, importRelationship) {
    return mapSeries(Object.keys(importRelationship), function(parent) {
      var rel = importRelationship[parent];
      var parentPath = rel.parentPath;
      var imports = rel.imports;
      var cache = this.cache[parentPath];
      var outFile = path.join(path.resolve('tmp', 'browserified', parent), parent + '-legacy.js');
      var nodeModulesPath = path.dirname(outFile) + '/node_modules';
      var stub = imports.map(function(imprt) {
        return generateStub(imprt.replace('npm:', ''));
      }).join('');

      fs.mkdirsSync(path.dirname(outFile));

      this.syncNodeModules(parentPath, nodeModulesPath);
      return this.updateThroughCache({
        cache: cache,
        stub: stub,
        imports: imports,
        parentPath: parentPath,
        outFile: outFile,
        destDir: destDir
      });
    }, this);
  }
};
