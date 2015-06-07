'use strict';

var AllDependencies = require('../../lib/all-dependencies');
var Dependency = require('../../lib/models/dependency');
var Descriptor = require('../../lib/models/descriptor');
var expect = require('chai').expect;

function modelEquals(result, expectation) {
  Object.keys(result).forEach(function(key) {
    expect(result[key]).to.deep.equal(expectation[key]);
  });
}

var descriptor = {
  root: '/workspace/example-app',
  packageName: 'example-app',
  srcDir: 'foo/bar/baz_tmp',
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

describe.only('all dependencies unit', function() {

  beforeEach(function () {
    AllDependencies._graph = {};
    AllDependencies._synced = {};
  });

  describe('update', function () {
    it('should update the graph with a new Dependency model', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(AllDependencies._graph['example-app'] instanceof Dependency);
    });

    it('should wrap the descriptor in a Descriptor model', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(AllDependencies._graph['example-app'].descriptor instanceof Descriptor);
    });

    it('should add the dependency to the graph', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(AllDependencies._graph['example-app']).to.deep.eql(new Dependency({
        descriptor: new Descriptor(descriptor),
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
        descriptor: new Descriptor(descriptor),
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

  describe('synced', function() {
    it('should add an item to the synced cache if it does not exist', function() {
      AllDependencies.synced('ember', 'ember/get');
      expect(AllDependencies._synced['ember']).to.deep.eql(['ember/get']);
    }); 

    it('should add an import to an existing package', function() {
      AllDependencies.synced('ember', 'ember/get');
      AllDependencies.synced('ember', 'ember/set');
      expect(AllDependencies._synced['ember']).to.deep.eql(['ember/get', 'ember/set']);
    }); 
  });

  describe('getSynced', function() {
    it('should return the entire sync object when called with no arguments', function() {
      AllDependencies.synced('ember', 'ember/get');
      expect(AllDependencies.getSynced()).to.deep.eql({ ember: ['ember/get'] });
    }); 

    it('should return just the imports synced for a package', function() {
      AllDependencies.synced('ember', 'ember/get');
      expect(AllDependencies.getSynced('ember')).to.deep.eql(['ember/get']);
    }); 
  });

  describe('isSynced', function() {
    it('should return a boolean if the item has been synced or not', function() {
      AllDependencies.synced('ember', 'ember/get');
      expect(AllDependencies.isSynced('ember', 'ember/get')).to.eql(true);
      expect(AllDependencies.isSynced('ember', 'ember/set')).to.eql(false);
    }); 
  });

  describe('add', function() {
    it('should add an item to the graph via a single import', function() {
      var desc = {
        root: 'foo/bar',
        packageName: 'bazing',
        nodeModulesPath: 'foo/bar/node_modules',
        pkg: { name: 'bazing', version: '9000.0.0' },
        relativePaths: undefined,
        parent: undefined,
        srcDir: 'foo/bar/tmp_fizzy'
      };
      AllDependencies.add(desc, 'bazing/a', { imports: ['bazing/b'] });
      var dependency = AllDependencies.for('bazing');
      modelEquals(dependency.descriptor, new Descriptor(desc));
      expect(dependency.graph).to.deep.eql({
        'bazing/a': { imports: [ 'bazing/b' ] }
      });
      expect(dependency.dedupedImports).to.deep.eql([ 'bazing/b' ]);
      expect(dependency.imports).to.deep.eql({
        'bazing/a': [ 'bazing/b' ]
      });
    }); 

    it('should add an item to the graph if it already exists', function() {
      var desc = {
        root: 'foo/bar',
        packageName: 'bazing',
        nodeModulesPath: 'foo/bar/node_modules',
        pkg: { name: 'bazing', version: '9000.0.0' },
        relativePaths: undefined,
        parent: undefined,
        srcDir: 'foo/bar/tmp_fizzy'
      };
      AllDependencies.add(desc, 'bazing/a', { imports: ['bazing/b'] });
      AllDependencies.add(desc, 'bazing/b', { imports: [] });
      var dependency = AllDependencies.for('bazing');

      modelEquals(dependency.descriptor, new Descriptor(desc));
      expect(dependency.graph).to.deep.eql({
        'bazing/a': { imports: [ 'bazing/b' ] },
        'bazing/b': { imports: [] }
      });
      expect(dependency.imports).to.deep.eql({
        'bazing/a': [ 'bazing/b' ],
        'bazing/b': [ ]
      });
      expect(dependency.dedupedImports).to.deep.eql([ 'bazing/b' ]);
    }); 
  });
});