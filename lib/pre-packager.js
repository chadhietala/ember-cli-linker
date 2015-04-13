'use strict';

var AllDependencies         = require('./all-dependencies');
var syncForwardDependencies = require('./sync-forward-dependencies');
var CoreObject              = require('core-object');
var RSVP                    = require('rsvp');
var walkSync                = require('walk-sync');
var path                    = require('path');
var quickTemp               = require('quick-temp');
var fs                      = require('fs-extra');
var mapSeries               = require('promise-map-series');

function uniq(arr) {
  return arr.reduce(function(a, b) {
    if (a.indexOf(b) < 0) {
      a.push(b);
    }
    return a;
  }, []);
}

function flatten(arr) {
  return arr.reduce(function(a, b) {
    return a.concat(b);
  });
}

function flatMap(arr, fn) {
  return flatten(arr.map(fn));
}

function isEntryFiles(entry) {
  return function(relativePath) {
    return relativePath.indexOf(entry) > -1 && relativePath.slice(-1) !== '/' && relativePath.indexOf('dep-graph.json') < 0;
  };
}

function importType(imprt) {
  var importParts = imprt.split(':');
  var type = {};

  if (importParts.length > 1) {
    type.type = importParts[0];
    type.id = importParts[1];
  } else {
    type.type = 'default';
    type.id = imprt;
  }

  return type;
}

module.exports = CoreObject.extend({
  init: function(inputTree, options) {
    var defaultResolvers = ['default', 'npm'];
    this.resolvers = {};
    this.inputTree = inputTree;
    this.options = options || {};

    if (!this.options.entries) {
      throw new Error('You must pass an array of entries.');
    }

    if (options.resolutionTypes) {
      this.resolutionTypes = options.resolutionTypes.concat(defaultResolvers);
    } else {
      this.resolutionTypes = defaultResolvers;
    }

    this.resolutionTypes.forEach(function(type) {
      this.resolvers[type] = require('./resolvers/' + type);
    }, this);

    this.entries = options.entries;
  },

  read: function(readTree) {
    quickTemp.makeOrRemake(this, 'tmpDestDir');
    return RSVP.Promise.resolve(this.write(readTree, this.tmpDestDir)).then(function() {
      return this.tmpDestDir;
    }.bind(this));
  },

  write: function(readTree, destDir) {
    var self = this;
    return readTree(this.inputTree).then(function(srcDir) {
      return self.resolveEntries(srcDir, destDir);
    });
  },

  /**
   * Syncs alll of the entries' files and then
   * begins the resolution and materialization
   * of the graph.
   * @param  {String} srcDir  The source directory of the files
   * @param  {String} destDir The destination temp directory
   * @return {Promise}
   */
  resolveEntries: function(srcDir, destDir) {
    var paths = walkSync(srcDir);

    return RSVP.Promise.all(this.entries.map(function(entry) {
      var entryDepGraphPath = fs.readJSONSync(path.join(srcDir, entry, 'dep-graph.json'));

      AllDependencies.update(entry, entryDepGraphPath);
      // Sync the entry
      paths.filter(isEntryFiles(entry)).forEach(function(relativePath) {
        syncForwardDependencies(path.join(destDir, relativePath), path.join(srcDir, relativePath));
      }, this);

      return this.selectResolution(srcDir, destDir, this.flattenEntryImports(entry, entryDepGraphPath));
      
    }, this));
  },

  /**
   * This is only called for an entry e.g. an app or engine.
   * Since an entry is the entry node in the graph you can safely
   * just get the unique dependencies in the entry.
   * @param  {String} entry     A top level node
   * @param  {String} graphPath The path to dep-graph.json
   * @return {Array}            The direct dependencies for the entry
   */
  flattenEntryImports: function(entry) {
    return uniq(flatMap(Object.keys(AllDependencies.for(entry)), function(file) {
      return AllDependencies.for(file);
    }));
  },

  /**
   * Selects the resolver based on the import type.
   * @param  {String} srcDir  The directory holding all of the soruce files
   * @param  {[type]} destDir The destination for the resolved graph
   * @param  {Array} imports An array of all the imports
   * @return {Promise}
   */
  selectResolution: function(srcDir, destDir, imports) {
    return mapSeries(uniq(imports), function(imprt) {
      var importInfo = importType(imprt);

      if (this.resolutionTypes.indexOf(importInfo.type) < 0) {
        throw new Error('You do not have a resolver for ' + importInfo.type + ' types.');
      }

      return this.resolvers[importInfo.type].resolve(
        srcDir, destDir, importInfo.id, this
      );

    }, this);
  },

  cleanup: function() {
    fs.removeSync(this.tmpDestDir);
  }
});