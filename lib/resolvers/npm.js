'use strict';

var RSVP              = require('rsvp');
var browserify        = require('browserify');
var path              = require('path');
var helpers           = require('broccoli-kitchen-sink-helpers');
var fs                = require('fs-extra');
var walkSync          = require('walk-sync');
var Immutable         = require('immutable');

function generateStub(moduleName) {
  return 'define("npm:' + moduleName + '", function() {' +
         'return { "default": require("' + moduleName + '") };' +
         '});';
}

module.exports = {

  files: Immutable.Map(),
  stubCache: Immutable.Map(),
  graph: Immutable.Map(),

  bundler: function(entry) {
    var b = browserify();
    b.add(entry);
    return b;
  },

  updateCache: function(entryFile, imprt) {
    return new RSVP.Promise(function(resolve, reject) {
      this.bundler(entryFile).bundle(function(err, data) {

        if (err) {
          reject(err);
        }

        fs.mkdirsSync(path.dirname(entryFile));
        fs.writeFileSync(entryFile, data);

        this.files.set(imprt, data);

        resolve();
      }.bind(this));
    }.bind(this));
  },

  checkStubCache: function(srcDir, entry) {
    var isStubCacheValid = true;

    if (!this.stubCache.get(entry)) {
      isStubCacheValid = false;
    }

    return isStubCacheValid;
  },

  checkGraphCache: function(srcDir, pkg) {
    var isGraphCacheValid = true;

    if (!this.graph.get(pkg)) {
      var pkgPath = path.join(srcDir, 'node_modules', pkg);

      var paths = walkSync(pkgPath).filter(function(relativePath) {
        return relativePath.slice(-1) !== '/';
      });

      var strings = paths.map(function(relativePath) {
        return fs.readFileSync(path.join(pkgPath, relativePath), 'utf8');
      }.bind(this));

      this.graph = this.graph.set(pkg, helpers.hashStrings(strings));
      isGraphCacheValid = false;
    }
    
    return isGraphCacheValid;
  },

  writeStub: function(destination, imprt) {
    var generatedStub = generateStub(imprt);
    fs.mkdirsSync(path.dirname(destination));
    fs.writeFileSync(destination, generateStub);
    this.stubCache = this.stubCache.set(imprt, generatedStub);
  },

  writeFileFromCache: function(destination, imprt) {
    fs.mkdirsSync(path.dirname(destination));
    fs.writeFileSync(destination, this.files.get(imprt));
  },

  writeStubFromCache: function(destination, imprt) {
    fs.mkdirsSync(path.dirname(destination));
    fs.writeFileSync(destination, this.stubCache.get(imprt));
  },

  resolve: function(srcDir, destDir, imprt) {
    var pkg = imprt.split('/')[0];
    var outFile = path.join(destDir, 'browserified', pkg, pkg + '.js');

    if (!this.checkStubCache(srcDir, imprt)) {
      this.writeStub(path.join(outFile), imprt);
    } else {
      this.writeStubFromCache(outFile, imprt);
    }

    if (!this.checkGraphCache(srcDir, imprt)) {
      return this.updateCache(outFile, imprt).then(function() {
        return destDir;
      });
    }

    this.writeFileFromCache(outFile, imprt);
    return RSVP.Promise.resolve(destDir);
  }
};