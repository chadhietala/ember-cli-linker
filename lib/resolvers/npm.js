'use strict';

var utils      = require('../utils');
var uniq       = utils.uniq; 
var RSVP       = require('rsvp');
var browserify = require('browserify');
var path       = require('path');
var helpers    = require('broccoli-kitchen-sink-helpers');
var fs         = require('fs-extra');
var walkSync   = require('walk-sync');
var mapSeries  = require('promise-map-series');

function _generateStub(moduleName) {
  return 'define("npm:' + moduleName + '", function() {' +
         'return { "default": require("' + moduleName + '") };' +
         '});';
}

function hashPackage(srcDir, pkg) {
  var pkgPath = path.join(srcDir, 'node_modules', pkg.split('/')[0]);

  return helpers.hashStrings(walkSync(pkgPath).filter(function(relativePath) {
    return relativePath.slice(-1) !== '/';
  }).map(function(relativePath) {
    return fs.readFileSync(path.join(pkgPath, relativePath), 'utf8');
  }));
}

module.exports = {
  cache: {},

  bundler: function(entry) {
    var b = browserify();
    b.add(entry);
    return b;
  },

  updateCache: function(entryFile, pkg) {
    return new RSVP.Promise(function(resolve, reject) {
      this.bundler(entryFile).bundle(function(err, data) {

        if (err) {
          reject(err);
        }

        fs.mkdirsSync(path.dirname(entryFile));
        fs.writeFileSync(entryFile, data);

        this.cache[pkg].buffer = data;

        resolve();
      }.bind(this));
    }.bind(this));
  },

  resolveLazily: function(srcDir, destDir, imports) {
    return mapSeries(Object.keys(imports), function(pkg) {
      var outFile = path.join(destDir, 'browserified', pkg, pkg + '.js');
      var stub = uniq(imports[pkg]).map(function(file) {
                  return _generateStub(file);
                }).join('');

      fs.mkdirsSync(path.dirname(outFile));

      if (!this.cache[pkg] || this.cache[pkg].stub !== stub || this.cache[pkg].hash !== hashPackage(srcDir, pkg)) {

        this.cache[pkg] = {
          stub: stub,
          hash: hashPackage(srcDir, pkg)
        };

        fs.writeFileSync(outFile, stub);
        return this.updateCache(outFile, pkg);
      }

      fs.writeFileSync(outFile, this.cache[pkg].buffer);

      return RSVP.Promise.resolve();

    }, this);
  }
};