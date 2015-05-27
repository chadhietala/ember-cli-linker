'use strict';

var AllDependencies = require('../../lib/all-dependencies');
var Dependency = require('../../lib/models/dependency');
var expect = require('chai').expect;

var descriptor = {
  name: 'example-app',
  root: '/workspace/example-app',
  nodeModulesPath: '/workspace/example-app/node_modules',
  pkg: {
    name: 'example-app',
    version: '0.0.1',
    dependencies: {
      lodash: '1.0.0'
    }
  },
  relativePaths: [
    'example-app/',
    'example-app/app.js',
    'example-app/router.js'
  ],
  parent: null
};

var dependencies = {
  'example-app/app': {
    imports: ['ember']
  },
  'example-app/router': {
    imports: ['ember', 'jquery']
  }
};

describe('all dependencies unit', function() {

  beforeEach(function () {
    AllDependencies._graph = {};
  });

  describe('update', function () {
    it('should update the graph with a new Dependency', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(AllDependencies._graph['example-app'] instanceof Dependency);
    });

    it('should add the dependency to the graph', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(AllDependencies._graph['example-app']).to.deep.eql(new Dependency({
        descriptor: descriptor,
        graph: dependencies,
        imports: {
          'example-app/app': ['ember'],
          'example-app/router': ['ember', 'jquery']
        },
        dedupedImports: ['ember', 'jquery']
      }));
    });
  });

  describe('for', function() {
    it('should return a graph for a package', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(AllDependencies.for('example-app')).to.deep.equal(new Dependency({
        descriptor: descriptor,
        graph: dependencies,
        imports: {
          'example-app/app': ['ember'],
          'example-app/router': ['ember', 'jquery']
        },
        dedupedImports: ['ember', 'jquery']
      }));
    });

    it('should return the imports for a specific file given it\'s parent', function() {
      AllDependencies.update(descriptor, dependencies);
      var imports = AllDependencies.for('example-app/router', 'example-app');
      expect(imports).to.deep.equal(['ember', 'jquery']);
    });

    it('should return throw if the file or package cannot be found', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(function() {
        return AllDependencies.for('dummy/router', 'dummy');
      }).to.throw(/dummy\/router cannot be found./);
    });
  });
});