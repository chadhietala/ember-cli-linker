'use strict';

var AllDependencies = require('../../lib/all-dependencies');
var expect = require('chai').expect;
var fs = require('fs-extra');

describe('all dependencies unit', function() {
  var depGraph;
  var cwd = process.cwd();

  before(function() {
    // Note: Normally this is used at the root of
    // the application that is being built.
    process.chdir('./tests/fixtures/example-app');
  });

  after(function() {
    process.chdir(cwd);
  });

  beforeEach(function () {
    depGraph = fs.readJSONSync('./tree/example-app/dep-graph.json');
    AllDependencies._graph = {};
  });

  describe('update', function () {
    it('should place a package into dep-graph keyed off of the package name', function() {
      AllDependencies.update('example-app', depGraph);
      expect(AllDependencies._graph['example-app']).to.deep.equal({
        'example-app/app': [
          'ember',
          'ember-resolver',
          'ember-load-initializers',
          'example-app/config/environment'
        ],
        'example-app/initializers/ember-moment': [
          'ember-moment/helpers/moment',
          'ember-moment/helpers/ago',
          'ember-moment/helpers/duration',
          'ember'
        ],
        'example-app/router': [
          'ember',
          'example-app/config/environment'
        ]
      });
    });

    it('should throw if no package is given', function() {
      var willThrow = function() {
        AllDependencies.update(depGraph);
      };

      expect(willThrow).to.throw(/You must pass an entry and a dependency graph./);
    });
  });

  describe('for', function() {
    it('should return a graph for a package', function() {
      AllDependencies.update('example-app', depGraph);
      expect(AllDependencies.for('example-app')).to.deep.equal({
        'example-app/app': [
          'ember',
          'ember-resolver',
          'ember-load-initializers',
          'example-app/config/environment'
        ],
        'example-app/initializers/ember-moment': [
          'ember-moment/helpers/moment',
          'ember-moment/helpers/ago',
          'ember-moment/helpers/duration',
          'ember'
        ],
        'example-app/router': [
          'ember',
          'example-app/config/environment'
        ]
      });
    });

    it('should return the imports for a specific file', function() {
      AllDependencies.update('example-app', depGraph);
      var imports = AllDependencies.for('example-app/initializers/ember-moment');
      expect(imports).to.deep.equal({
        pkgName: 'example-app',
        entry: 'example-app',
        imports: [
          'ember-moment/helpers/moment',
          'ember-moment/helpers/ago',
          'ember-moment/helpers/duration',
          'ember'
        ],
        parent: undefined,
        pkgPath: process.cwd()
      });
    });

    it('should return an empty Map if the package graph is not found', function() {
      expect(AllDependencies.for('example-moment')).to.deep.equal({});
    });

    it('should return an empty List if the file imports are not found', function() {
      expect(AllDependencies.for('example-moment/ago.js')).to.deep.equal({});
    });
  });
});