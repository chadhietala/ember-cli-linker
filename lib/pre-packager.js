'use strict';

var AllDependencies         = require('./all-dependencies');
var syncForwardDependencies = require('./sync-forward-dependencies');
var utils                   = require('./utils');
var uniq                    = utils.uniq;
var flatMap                 = utils.flatMap;
var isEntryFiles            = utils.isEntryFiles;
var getImportInfo           = utils.getImportInfo;
var CoreObject              = require('core-object');
var RSVP                    = require('rsvp');
var walkSync                = require('walk-sync');
var path                    = require('path');
var quickTemp               = require('quick-temp');
var fs                      = require('fs-extra');
var mapSeries               = require('promise-map-series');

module.exports = CoreObject.extend({
  init: function(inputTree, options) {
    var defaultResolvers = ['addon', 'npm'];
    this.resolvers = {};
    this.inputTree = inputTree;
    this.options = options || {};
    this.importCache = null;

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

    this.importCache = {};

    return RSVP.Promise.all(this.entries.map(function(entry) {
      var entryDepGraph = fs.readJSONSync(path.join(srcDir, entry, 'dep-graph.json'));

      AllDependencies.update(entry, entryDepGraph);
      // Sync the entry
      paths.filter(isEntryFiles(entry)).forEach(function(relativePath) {
        syncForwardDependencies(path.join(destDir, relativePath), path.join(srcDir, relativePath));
      }, this);

      return this.selectResolution(srcDir, destDir, this.flattenEntryImports(entry, entryDepGraph));
      
    }, this)).finally(function () {

      return RSVP.Promise.all(Object.keys(this.resolvers).map(function(resolver) {
        var resolveLazily = this.resolvers[resolver].resolveLazily;
        var importCache = this.importCache[resolver];

        if (resolveLazily && importCache) {
          return resolveLazily.call(this.resolvers[resolver], srcDir, destDir, importCache);
        }

        return RSVP.Promise.resolve();
      }, this));
    }.bind(this));
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
      var importInfo = getImportInfo(imprt);

      if (this.resolutionTypes.indexOf(importInfo.type) < 0) {
        throw new Error('You do not have a resolver for ' + importInfo.type + ' types.');
      }

      if (!this.importCache[importInfo.type]) {
        this.importCache[importInfo.type] = {};
      }

      if (!this.importCache[importInfo.type][importInfo.pkg]) {
        this.importCache[importInfo.type][importInfo.pkg] = [importInfo.id];
      } else {
        this.importCache[importInfo.type][importInfo.pkg].push(importInfo.id);
      }

      if (this.resolvers[importInfo.type].resolve) {
        return this.resolvers[importInfo.type].resolve(
          srcDir, destDir, importInfo.id, this
        );
      }

      return RSVP.Promise.resolve(destDir);


    }, this);
  },

  cleanup: function() {
    fs.removeSync(this.tmpDestDir);
  }
});