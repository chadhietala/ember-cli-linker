'use strict';

var RSVP              = require('rsvp');
var browserify        = require('browserify');
var path              = require('path');
var helpers           = require('broccoli-kitchen-sink-helpers');
var fs                = require('fs-extra');
var resolve           = require('resolve').sync;
var quickTemp         = require('quick-temp');
var symlinkOrCopySync = require('symlink-or-copy').sync;
var walkSync          = require('walk-sync');

function hashFile(file) {
  var buf;
  try {
    buf = fs.readFileSync(file);
    return helpers.hashStrings([buf]);
  } catch (e) {
    return null;
  }
}

module.exports = {
  cache: {},

  checkCache: function(file) {
    var isCacheClean = true;

    if (!this.cache[file]) {
      isCacheClean = false;
    }

    return isCacheClean;
  },

  bundler: function(entry) {
    if (!this._bundler) {
      this._bundler = this.makeBundler(entry);
    }

    return this._bundler;
  },

  makeBundler: function(entry) {
    var b = browserify();

    b.on('file', function() {
      console.log(arguments);
    });

    b.on('dep', function() {
      console.log(arguments);
    });

    b.on('error', function() {
      console.log(arguments);
    });

    b.add(entry);

    return b;
  },

  checkImport: function(imprt) {
    // var parts = imprt.split('/');

    // if (parts.length > 1) {
    //   return path.join(this._inputStaging, imprt);
    // }

    // return path.join(this._inputStaging, imprt, 'index.js');

    // // var mainFile = resolve(imprt, {
    // //   basedir: this._inputStaging
    // // });
    
    // // return mainFile;
  },

  updateCache: function(entry, destDir) {
    // var self = this;
    // return new RSVP.Promise(function(resolve, reject) {
    //   self.bundler(entry).bundle(function(err, data) {
    //     if (err) {
    //       console.log(err);
    //       reject(err);
    //     }
    //     console.log(data.toString());

    //     var outputFile = path.join(destDir, self.entryFile);
    //     fs.mkdirsSync(path.dirname(outputFile));
    //     fs.writeFileSync(outputFile, data);

    //     resolve(destDir);
    //   });
    // });
  },

  _rebuild: function(srcDir, destDir, imprt) {


    // var self = this;
    // this._watchModules = Object.create(null);
    // // fs.removeSync(this._inputStaging);
    // fs.mkdirsSync(this._inputStaging);

    // var paths = walkSync(srcDir);

    // var packageName = imprt.split('/')[0];

    // fs.mkdirsSync(path.join(this._inputStaging, packageName));

    // paths.forEach(function(relativePath) {
    //   if (relativePath !== packageName + '/') {
    //     fs.mkdirsSync(path.join(self._inputStaging, path.dirname(relativePath)));
    //     fs.copySync(path.join(srcDir, relativePath), path.join(self._inputStaging, relativePath));
    //   }
    // });

    // return this.updateCache(this.checkImport(imprt), destDir);
  },

  resolve: function(srcDir, destDir, imprt) {

    return new RSVP.Promise(function(resolve, reject) {
      
    });
  }
};