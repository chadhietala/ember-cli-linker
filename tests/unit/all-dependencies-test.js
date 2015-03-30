'use strict';

var AllDependencies = require('../../lib/all-dependencies');
var expect = require('chai').expect;
var fs = require('fs-extra');
var depGraph = fs.readJSONSync('./tests/fixtures/example-app/dep-graph.json');
var Immutable = require('immutable');

describe('all dependencies unit', function() {

  beforeEach(function () {
    AllDependencies._graph = {};
  });

  describe('update', function () {
    it('should place a package into dep-graph keyed off of the package name', function() {
      AllDependencies.update('example-app', depGraph);
      expect(AllDependencies._graph['example-app']).to.deep.equal(depGraph);
      expect(AllDependencies._graph['example-app']).to.deep.equal(depGraph);
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
      expect(AllDependencies.for('example-app')).to.deep.equal(Immutable.fromJS(depGraph));
    });

    it('should return the imports for a specific file', function() {
      AllDependencies.update('example-app', depGraph);
      var imports = AllDependencies.for('example-app/initializers/ember-moment.js');
      expect(imports.toJS()).to.deep.equal([
        'ember-moment/helpers/moment',
        'ember-moment/helpers/ago',
        'ember-moment/helpers/duration',
        'ember'
      ]);
    });

    it('should return an empty Map if the package graph is not foudn', function() {
      var imports = AllDependencies.for('example-moment/ago.js');
      expect(imports).to.deep.equal(Immutable.Map());
    });
  });
});