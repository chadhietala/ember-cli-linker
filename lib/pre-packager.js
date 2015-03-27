'use strict';

var AllDependencies   = require('./all-dependencies');
var CoreObject        = require('core-object');
var RSVP              = require('rsvp');
var walkSync          = require('walk-sync');
var path              = require('path');
var symlinkOrCopySync = require('symlink-or-copy').sync;
var quickTemp         = require('quick-temp');
var fs                = require('fs-extra');
var Immutable         = require('immutable');

module.exports = CoreObject.extend({
  init: function(inputTree, options) {
    this.inputTree = inputTree;
    this.options = options || {};

    if (!this.options.entries) {
      throw new Error('You must pass an array of entries.');
    }

    this.entries = options.entries;
  },

  read: function(readTree) {
    quickTemp.makeOrRemake(this, 'tmpDestDir');
    return RSVP.Promise.resolve(this.write(readTree, this.tmpDestDir)).then(function () {
      return this.tmpDestDir;
    }.bind(this));
  },

  write: function(readTree, destDir) {
    var self = this;
    return readTree(this.inputTree).then(function(srcDir) {
      return self.resolveEntries(srcDir, destDir);
    });
  },

  resolveEntries: function(srcDir, destDir) {
    var self = this;
    var paths = walkSync(srcDir);

    this.entries.forEach(function(entry) {
      var entryDepGraphPath = path.join(srcDir, entry, 'dep-graph.json');

      // Sync the entry
      paths.filter(self._isEntryFiles(entry)).forEach(function(relativePath) {
        self.syncForwardDependencies(path.join(destDir, relativePath), path.join(srcDir, relativePath));
      });

      self.resolve(srcDir, destDir, self.flattenEntryImports(entry, entryDepGraphPath));
    });

    return destDir;
  },

  _isEntryFiles:function(entry) {
    return function(relativePath) {
      return relativePath.indexOf(entry) > -1 && relativePath.slice(-1) !== '/' && relativePath.indexOf('dep-graph.json') < 0;
    };
  },

  syncForwardDependencies: function(destination, dep) {
    fs.mkdirsSync(path.dirname(destination));
    symlinkOrCopySync(dep, destination);
  },

  /**
   * This is only called for an entry e.g. an app or engine.
   * Since an entry is the entry node in the graph you can safely
   * just get the unique dependencies in the entry.
   * @param  {String} entry     A top level node
   * @param  {String} graphPath The path to dep-graph.json
   * @return {Array}            The direct dependencies for the entry
   */
  flattenEntryImports: function(entry, graphPath) {
    this.updateGraph(entry, graphPath);
    return Immutable.Set(AllDependencies.for(entry).keySeq().flatMap(function(file) {
      return AllDependencies.for(file);
    }));
  },

  updateGraph: function(entry, graphPath) {
    AllDependencies.update(entry, fs.readJSONSync(graphPath));
  },

  _getEntry: function(relativePath) {
    return relativePath.split('/')[0];
  },

  resolve: function(srcDir, destDir, imports) {
    var self = this, entry;
    
    imports.filter(function(imprt) {
      entry = self._getEntry(imprt);

      // NOTE: This is where we would need to actually introduce
      // alternative resolution paths. Current I'm filering out
      // the things like 'ember', 'moment', etc.
      return fs.existsSync(path.join(srcDir, entry));
    }).forEach(function(imprt) {
      entry = self._getEntry(imprt);
      imprt = imprt + '.js';

      var dep = path.join(srcDir, imprt);
      var depGraph = path.join(srcDir, entry, 'dep-graph.json');

      if (!fs.existsSync(path.join(destDir, imprt))) {
        var destination = path.join(destDir, imprt);

        self.syncForwardDependencies(destination, dep);

        if (!AllDependencies.for(entry)) {
          self.updateGraph(entry, depGraph);
          // We now look at the direct path to resolve all the
          // transitive dependencies.
          self.resolve(srcDir, destDir, AllDependencies.for(imprt));
        }

      }
    });
  },

  cleanup: function() {
    fs.removeSync(this.tmpDestDir);
  }
});