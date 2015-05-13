'use strict';

var PrePackager = require('../../lib/pre-packager');
var AllDependencies = require('../../lib/all-dependencies');
var expect = require('chai').expect;
var temp = require('quick-temp');
var path = require('path');

describe('PrePackager#constructor', function() {
  var cwd = process.cwd();
  var prePackager;

  beforeEach(function() {
    AllDependencies._graph = {};
    AllDependencies._merged = {};
    process.chdir('./tests/fixtures/example-app');
  });

  afterEach(function() {
    if (prePackager) {
      prePackager = null;
    }

    process.chdir(cwd);
  });

  it('should throw if no entries are passed', function() {
    var willThrow = function() {
      return new PrePackager();
    };

    expect(willThrow).to.throw(/You must pass an array of entries./);
  });

  describe('PrePackager#generatePkgInfo', function() {
    it('should generate pkgInfo that coaleases the imports', function() {
      prePackager = new PrePackager('trees', {
        entries: ['example-app']
      });

      AllDependencies._graph = {
        'example-app': {
          'example-app/app': [
            'ember'
          ],
          'example-app/router': [
            'example-app/config/environment'
          ]
        },
        'ember': {
          'ember/ember': []
        }
      };

      expect(prePackager.generatePkgInfo('example-app')).to.deep.eql({
        pkgPath: process.cwd(),
        pkgName: 'example-app',
        imports: ['ember', 'example-app/config/environment'],
        nodeModulesPath: path.join(process.cwd(), 'node_modules')
      });

    });
  });

  describe('PrePackager#cacheImport', function() {
    prePackager = new PrePackager('trees', {
      entries: ['example-app']
    });

    prePackager.importCache = {};

    var importInfo = {
      type: 'addon',
      name: 'ember-moment/ago',
      pkgName: 'ember-moment'
    };

    var parentInfo = {
      pkgName: 'example-app',
      pkgPath: process.cwd()
    };

    prePackager.cacheImport(importInfo, parentInfo);

    expect(prePackager.importCache).to.deep.eql({
      addon: {
        'example-app': {
          parent: 'example-app',
          imports: ['ember-moment/ago'],
          parentPath: process.cwd(),
          nodeModulesPath: path.join(process.cwd(), 'node_modules')
        }
      } 
    });
  });

  describe('PrePackager#parseTree', function() {

    it('should call syncForwardAssets if there is not a dep-graph.json', function() {
      var tmpDir = temp.makeOrReuse({}, 'tmpDirTest');
      var args;

      prePackager = new PrePackager('trees', {
        entries: ['example-app']
      });

      prePackager.syncForwardAssets = function() {
        args = arguments;
      };

      prePackager.parsedTrees = {};

      prePackager.parseTree([
        'example-app/app'
      ], tmpDir);

      expect(args[0]).to.deep.eql(['example-app/app']);
      expect(args[1]).to.eql(tmpDir);
      expect(prePackager.parsedTrees).to.deep.eql({});
    });

    it('should not call syncForwardAssets if there is a dep-graph.json', function() {
      var tmpDir = temp.makeOrReuse({}, 'tmpDirTest');
      var args;

      prePackager = new PrePackager('trees', {
        entries: ['example-app']
      });

      prePackager.syncForwardAssets = function() {
        args = arguments;
      };

      prePackager.parsedTrees = {};

      prePackager.parseTree([
        'example-app/app',
        'example-app/dep-graph.json'
      ], tmpDir);

      expect(args).to.eql(undefined);
      expect(prePackager.parsedTrees).to.deep.eql({
        'example-app': {
          inputPath: tmpDir,
          relativePaths: [
            'example-app/app',
            'example-app/dep-graph.json'
          ]
        }
      });
    });

  });


});