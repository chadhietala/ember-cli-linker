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

function generateStub(moduleName) {
  return 'define("npm:' + moduleName + '", function() {' +
         'return { "default": require("' + moduleName + '") };' +
         '});';
}

function gatherStubs(srcDir, relativePath, cache) {
  var src = fs.readFileSync(resolve(relativePath, {basedir: srcDir }));
  var hash = helpers.hashStrings([src]);

  if (!cache[relativePath]) {
    cache[relativePath] = hash;
  }
}

module.exports = {
  cache: {},

  stubCache: {},

  checkCache: function(file) {
    var isCacheClean = true;

    if (!this.cache[file]) {
      isCacheClean = false;
      return isCacheClean;
    }

    

    if (this.cache[file].hash !== hashFile(file)) {
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
    var b = browserify({
      basedir: this._inputStaging
    });

    b.on('file', function() {
      console.log(arguments);
    });

    b.on('deps', function() {
      console.log(arguments);
    });

    // console.log(fs.existsSync(entry));
    // console.log(walkSync(path.join(this._inputStaging)), this._inputStaging);
    // console.log(entry);
    b.add('./node_modules/moment/index.js');

    return b;
  },

  checkImport: function(imprt) {
    // console.log(path.join(this._inputStaging, 'node_modules', 'moment'));
    return resolve(imprt, {
      basedir: path.join(this._inputStaging, 'node_modules', 'moment')
    });
  },

  updateCache: function(entry, destDir) {
    var self = this;

    return new RSVP.Promise(function(resolve, reject) {
      self.bundler(entry).bundle(function(err, data) {
        // var outputFile = path.join(destDir, self.entryFile);

        if (err) {

          // console.log(err);
          reject(err);
        }

        console.log(data.toString());

        
        // fs.mkdirsSync(path.dirname(outputFile));
        // fs.writeFileSync(outputFile, data);

        resolve(destDir);
      });
    });
  },

  _rebuild: function(srcDir, destDir, imprt) {
    var self = this;
    var packageName = imprt.split('/')[0];
    // this._watchModules = Object.create(null);
    
    quickTemp.makeOrRemake(this, '_inputStaging');
    fs.mkdirsSync(this._inputStaging);
    var paths = walkSync(path.join(srcDir, 'node_modules', packageName));
    var stagingPath = path.join(this._inputStaging, 'node_modules', packageName);
    
    fs.mkdirsSync(stagingPath);

    paths.forEach(function(relativePath) {
      var from = path.join(srcDir, 'node_modules', packageName, relativePath);
      var to = path.join(stagingPath, relativePath);

      if (relativePath.substr(relativePath.length - 1) === '/') {
        fs.mkdirsSync(to);
      } else {
        symlinkOrCopySync(from, to);
      }
    });

    return this.updateCache(this.checkImport(imprt), destDir);
  },

  resolve: function(srcDir, destDir, imprt) {
    if (!this.stubCache[imprt]) {
      gatherStubs(srcDir, imprt, this.stubCache);
      fs.mkdirsSync(path.join(destDir, 'browserified', imprt.split('/')[0]));
      this.entryFile = path.join(destDir, 'browserified', imprt.split('/')[0], imprt.split('/')[0] + '.js');
      console.log(generateStub(imprt));
      fs.writeFileSync(this.entryFile, generateStub(imprt));

      return new RSVP.Promise(function(resolve, reject) {
        var b = browserify();

        b.add(this.entryFile);

        b.bundle(function(err, data) {
          console.log(err, data.toString());
          if (err) {
            reject(err);
          }
          resolve(destDir);
        });

      }.bind(this));
    }


    // if (!this.checkCache(imprt)) {
    //   console.log(generateStub(imprt));
    //   return this._rebuild(srcDir, destDir, imprt);
    // }

    return RSVP.Promise.resolve();

  }
};