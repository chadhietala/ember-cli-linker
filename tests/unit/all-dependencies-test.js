'use strict';

var AllDependencies = require('../../lib/all-dependencies');
var expect = require('chai').expect;
var fs = require('fs-extra');

describe('all dependencies unit', function() {
  var appDepGraph;
  var testDepGraph;
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
    appDepGraph = fs.readJSONSync('./tree/example-app/dep-graph.json');
    testDepGraph = fs.readJSONSync('./tree/example-app-tests/dep-graph.json');
    AllDependencies._graph = {};
    AllDependencies._merged = {};
  });

  describe('update', function () {
    it('should place a package into dep-graph keyed off of the package name', function() {
      AllDependencies.update('example-app', appDepGraph);
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
        AllDependencies.update(appDepGraph);
      };

      expect(willThrow).to.throw(/You must pass an entry and a dependency graph./);
    });
  });

  describe('for', function() {
    it('should return a graph for a package', function() {
      AllDependencies.update('example-app', appDepGraph);
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
      AllDependencies.update('example-app', appDepGraph);
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
  
  describe('mergeImports', function() {
    it('should merge the imports of 2 graphs', function() {
      AllDependencies.update('example-app', appDepGraph);
      AllDependencies.update('example-app-tests', testDepGraph);
      AllDependencies.mergeImports('example-app', 'example-app-tests');

      expect(AllDependencies._graph['example-app']).to.deep.eql({
        'example-app/app': [
          'ember',
          'ember-resolver',
          'ember-load-initializers',
          'example-app/config/environment'
        ],
        'example-app-tests/unit/components/foo-bar-test': [
          'ember'
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

    it('should save the merge relationship', function() {
      AllDependencies.update('example-app', appDepGraph);
      AllDependencies.update('example-app-tests', testDepGraph);
      AllDependencies.mergeImports('example-app', 'example-app-tests');

      expect(AllDependencies._merged).to.deep.eql({
        'example-app-tests': 'example-app'
      });
    });

    it('should not let you merge something into multiple entries', function() {
      var momentGraph = fs.readJSONSync('./tree/ember-moment/dep-graph.json');
      AllDependencies.update('example-app', appDepGraph);
      AllDependencies.update('example-app-tests', testDepGraph);
      AllDependencies.update('ember-moment', momentGraph);
      AllDependencies.mergeImports('example-app', 'example-app-tests');
      var throws = function() {
        AllDependencies.mergeImports('ember-moment', 'example-app-tests');
      };

      expect(throws).to.throw(/You attempted to merge example-app-tests into ember-moment, but is already merged with example-app./); 
    });
  });

  describe('mergedInto', function() {
    it('should pass back the merge relationship if the items are merged', function() {
      AllDependencies.update('example-app', appDepGraph);
      AllDependencies.update('example-app-tests', testDepGraph);
      AllDependencies.mergeImports('example-app', 'example-app-tests');
      expect(AllDependencies.mergedInto('example-app-tests')).to.eql('example-app');
    });

    it('should pass back undefined if the entry has not been merged', function() {
      AllDependencies.update('example-app', appDepGraph);
      AllDependencies.update('example-app-tests', testDepGraph);
      expect(AllDependencies.mergedInto('example-app-tests')).to.eql(undefined);
    });
  });
});