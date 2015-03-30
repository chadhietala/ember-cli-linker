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

function classify(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = CoreObject.extend({
  init: function(inputTree, options) {
    var defaultResolvers = ['npm']
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

  checkCache: function(entry, graphPath) {
    var existingGraph = AllDependencies.for(entry);
    var newGraph = Immutable.fromJS(fs.readJSONSync(graphPath));

    if (existingGraph !== newGraph) {
      this.updateGraph(entry, graphPath);
      return false;
    }

    return true;
  },

  resolveEntries: function(srcDir, destDir) {
    var self = this;
    var paths = walkSync(srcDir);

    this.entries.forEach(function(entry) {
      var entryDepGraphPath = path.join(srcDir, entry, 'dep-graph.json');
      var cacheValid = self.checkCache(entry, entryDepGraphPath);

      if (!cacheValid) {
        // Sync the entry
        paths.filter(self._isEntryFiles(entry)).forEach(function(relativePath) {
          self.syncForwardDependencies(path.join(destDir, relativePath), path.join(srcDir, relativePath));
        });

        self.selectResolution(srcDir, destDir, self.flattenEntryImports(entry, entryDepGraphPath));
      }
    });

    return destDir;
  },

  _isEntryFiles:function(entry) {
    return function(relativePath) {
      return relativePath.indexOf(entry) > -1 && relativePath.slice(-1) !== '/' && relativePath.indexOf('dep-graph.json') < 0;
    };
  },

  syncForwardDependencies: function(destination, dependency) {
    if (!fs.existsSync(destination)) {
      fs.mkdirsSync(path.dirname(destination));
      symlinkOrCopySync(dependency, destination);
    }
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

  importType: function(imprt) {
    var importParts = imprt.split(':');
    return importParts.length > 1 ? importParts[0] : 'default';
  },

  selectResolution: function(srcDir, destDir, imports) {
    var self = this;

    imports.forEach(function(imprt) {
      var importType = self.importType(imprt);

      if (self.resolutionTypes.indexOf(importType) > -1) {
        self['resolve' + classify(importType)](srcDir, destDir, imprt);
      } else {
        self.defaultResolver(srcDir, destDir, imprt);
      }

    });
  },

  resolveNpm: function(srcDir, destDir, imprt) {
    console.log(imprt);
  },

  defaultResolver: function(srcDir, destDir, imprt) {
    var entry = this._getEntry(imprt);
    
    // if the import is the same as the entry it is "main" file else 
    // it is a file import
    imprt = entry === imprt ? entry + '/' + imprt + '.js' : imprt + '.js';

    var depGraph = path.join(srcDir, entry, 'dep-graph.json');

    if (!this.checkCache(entry, depGraph)) {
      var dependency = path.join(srcDir, imprt);
      var destination = path.join(destDir, imprt);
      this.syncForwardDependencies(destination, dependency);
      this.selectResolution(srcDir, destDir, AllDependencies.for(imprt));
    }
  },
  
  cleanup: function() {
    fs.removeSync(this.tmpDestDir);
  }
});