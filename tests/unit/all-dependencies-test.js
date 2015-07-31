'use strict';

var AllDependencies = require('../../lib/all-dependencies');
var Package = require('../../lib/models/package');
var Descriptor = require('ember-cli-tree-descriptor');
var expect = require('chai').expect;
var Graph = require('graphlib').Graph;

function clone(obj) {
  var ret = {};

  Object.keys(obj).forEach(function(item)  {
    ret[item] = obj[item];
  });

  return ret;
}

function stripFileExtensions(graph) {
  var graphClone = clone(graph);
  var _graph = {};

  Object.keys(graphClone).forEach(function(file) {
    var fileName = file.replace('.js', '');
    _graph[fileName] = graphClone[file];
  });

  return _graph;
}

describe('all dependencies unit', function() {
  var denormalizedGraph, descriptor, ember, lodash, jquery;
  beforeEach(function () {
    AllDependencies.graph = new Graph();
    AllDependencies._packages = {};

    ember = {
      'imported': [
        'default'
      ],
      'source': 'ember',
      'specifiers': [
        {
          'imported': 'default',
          'kind': 'named',
          'local': 'Ember'
        }
      ]
    };

    lodash = {
      'imported': [
        'default'
      ],
      'source': 'lodash',
      'specifiers': [
        {
          'imported': 'default',
          'kind': 'named',
          'local': 'lodash'
        }
      ]
    };

    jquery = {
      'imported': [
        'default'
      ],
      'source': 'npm:jquery',
      'specifiers': [
        {
          'imported': 'default',
          'kind': 'named',
          'local': '$'
        }
      ]
    };


    denormalizedGraph = {
      'example-app/app.js': {
        exports: {
          exported: [],
          specifiers: []
        },
        imports: [ember]
      },
      'example-app/router.js': {
        exports: {
          exported: [],
          specifiers: []
        },
        imports: [jquery, ember]
      }
    };

    descriptor = {
      root: '/workspace/example-app',
      packageName: 'example-app',
      name: 'example-app',
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
  });

  describe('setEdge', function() {
    it('should create an edge for each head', function() {
      AllDependencies.setEdge('a', ['b', 'c']);
      expect(AllDependencies.graph.outEdges('a')).to.deep.eql([
        {
          'v': 'a',
          'w': 'b'
        },
        {
          'v': 'a',
          'w': 'c'
        }
      ]);
    });

    it('should not mutate the graph if no heads are supplied', function() {
      AllDependencies.setEdge('a');
      expect(AllDependencies.graph.nodes()).to.deep.eql([]);
    });
  });

  describe('sync', function() {
    it('should add the node to the graph', function() {
      AllDependencies.sync('a', ['b'], { packageName: 'a' });
      expect(AllDependencies.graph.nodes()).to.deep.eql(['a', 'b']);
    });

    it('should not mutate the tail node\'s  label', function() {
      AllDependencies.sync('a', ['b'], { packageName: 'a' });
      AllDependencies.sync('a', ['c'], { packageName: 'a', shouldNotAppear: true });
      expect(AllDependencies.graph.node('a')).to.deep.eql({
        packageName: 'a'
      });
    });

    it('if a mapping to the main file exits it should be used', function() {
      AllDependencies.sync('foo/lib/main', ['b'], { packageName: 'a', mainMapping: ['foo', 'foo/lib/main'] });
      expect(AllDependencies.graph.nodes()).to.deep.eql(['foo', 'b']);
    });
  });

  describe('getDescriptors', function() {
    it('should return meta data for a node', function() {
      AllDependencies._packages = {
        a: {
          descriptor: { srcDir: '/a' }
        },
        b: {
          descriptor: { srcDir: '/b' }
        }
      };
      expect(AllDependencies.getDescriptors()).to.deep.eql([
        { srcDir: '/a' },
        { srcDir: '/b' }
      ]);
    });
  });

  describe('getNodeMeta', function() {
    it('should return meta data for a node', function() {
      AllDependencies.graph.setNode('a', {isNode: true });
      expect(AllDependencies.getNodeMeta('a')).to.deep.eql({ isNode: true });
    });

    it('should return an array of meta data for the nodes', function() {
      AllDependencies.graph.setNode('a', {isNode: true });
      AllDependencies.graph.setNode('b', {isNode: false });
      expect(AllDependencies.getNodeMeta(['a', 'b'])).to.deep.eql([
        { isNode: true },
        { isNode: false }
      ]);
    });
  });

  describe('byType', function() {
    it('should collect nodes by type meta', function() {
      AllDependencies.graph.setNode('a', {type: 'npm' });
      AllDependencies.graph.setNode('b', {type: 'npm' });
      AllDependencies.graph.setNode('c', {type: 'es' });
      expect(AllDependencies.byType('npm')).to.deep.eql([
        'a',
        'b'
      ]);
    });
    it('should collect nodes by type annotation', function() {
      AllDependencies.graph.setNode('npm:a');
      AllDependencies.graph.setNode('npm:b');
      AllDependencies.graph.setNode('es:c');
      expect(AllDependencies.byType('npm')).to.deep.eql([
        'npm:a',
        'npm:b'
      ]);
    });
  });

  describe('getSyncedPackages', function() {
    it('should collect names of the packages synced', function() {
      AllDependencies.graph.setNode('a', {packageName: 'a' });
      AllDependencies.graph.setNode('b', {packageName: 'b' });
      AllDependencies.graph.setNode('a/foo', {packageName: 'a'});
      expect(AllDependencies.getSyncedPackages()).to.deep.eql([
        'a',
        'b'
      ]);
    });
  });

  describe('byPackageNames', function() {
    it('should collect nodes that are in the specified packages', function() {
      AllDependencies.graph.setNode('a', {packageName: 'a' });
      AllDependencies.graph.setNode('b', {packageName: 'b' });
      AllDependencies.graph.setNode('a/foo', {packageName: 'a'});
      AllDependencies.graph.setNode('c', {packageName: 'c'});
      expect(AllDependencies.byPackageNames(['a', 'c'])).to.deep.eql([
        'a',
        'a/foo',
        'c'
      ]);
    });
  });

  describe('isSynced', function() {
    it('should return true if the node is synced', function() {
      AllDependencies.graph.setNode('a', {syncedToDisk: true });
      AllDependencies.graph.setNode('b');
      AllDependencies.graph.setNode('a/foo', {syncedToDisk: true});
      expect(AllDependencies.isSynced('a')).to.eql(true);
      expect(AllDependencies.isSynced('a/foo')).to.eql(true);
      expect(AllDependencies.isSynced('b')).to.eql(false);
    });
  });

  describe('pruneUnreachable', function() {
    it('prunes unreachable nodes from the graph', function() {
      AllDependencies.setRoots(['a']);
      AllDependencies.sync('a', ['b', 'c'], {
        packageName: 'a'
      });
      AllDependencies.graph.setNode('d', { packageName: 'd' });

      expect(AllDependencies.graph.nodes()).to.deep.eql([
        'a',
        'b',
        'c',
        'd'
      ]);

      AllDependencies.pruneUnreachable();
      expect(AllDependencies.graph.nodes()).to.deep.eql([
        'a',
        'b',
        'c'
      ]);
    });
  });

  describe('update', function () {
    it('should update the graph with a new Package model', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      expect(AllDependencies._packages['example-app'] instanceof Package);
    });

    it('should wrap the descriptor in a Descriptor model', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      expect(AllDependencies._packages['example-app'].descriptor instanceof Descriptor);
    });

    it('should add the package to the graph', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      var _denormalizedGraph = stripFileExtensions(denormalizedGraph);

      expect(AllDependencies._packages['example-app']).to.deep.eql(new Package({
        descriptor: descriptor,
        denormalizedGraph: _denormalizedGraph,
        imports: {
          'example-app/app': ['ember'],
          'example-app/router': ['npm:jquery', 'ember']
        },
        dedupedImports: ['ember', 'npm:jquery']
      }));
    });

    it('should perform an idempotent update if the package exists', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      var _denormalizedGraph = stripFileExtensions(denormalizedGraph);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;
      var updateRelativePathsCalled = false;

      desc.updateRelativePaths = function() {
        updateRelativePathsCalled = true;
      };

      AllDependencies.update(descriptor, denormalizedGraph);

      delete desc.updateRelativePaths;

      expect(AllDependencies._packages['example-app']).to.deep.eql(new Package({
        descriptor: descriptor,
        denormalizedGraph: _denormalizedGraph,
        imports: {
          'example-app/app': ['ember'],
          'example-app/router': ['npm:jquery', 'ember']
        }
      }));

      expect(updateRelativePathsCalled).to.eql(true);
    });

    it('should update the graph if imports are removed', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;
      desc.updateRelativePaths = function() {};

      AllDependencies.setRoots(['example-app']);

      AllDependencies.update({ packageName: 'ember' }, {
        'ember': {
          'imports': []
        }
      });

      AllDependencies.sync('example-app/app', ['ember'], {
        packageName: 'example-app',
        syncedToDisk: true
      });

      AllDependencies.sync('example-app/router', ['ember', 'npm:jquery'], {
        packageName: 'example-app',
        syncedToDisk: true
      });

      AllDependencies.sync('ember', [], {
        packageName: 'ember',
        syncedToDisk: true
      });

      AllDependencies.sync('npm:jquery', [], {
        packageName: 'npm:jquery',
        syncedToDisk: true,
        mainMapping: ['jquery', 'npm:jquery']
      });


      var modifiedDependencies = clone(denormalizedGraph);

      modifiedDependencies['example-app/router.js'].imports = [];

      AllDependencies.update(descriptor, modifiedDependencies);

      expect(AllDependencies.graph.nodes()).to.deep.eql([
        'example-app/app',
        'ember',
        'example-app/router'
      ]);
    });

    it('annotated imports have a shadow node', function() {
      AllDependencies.sync('foo', ['npm:jquery'], {
        packageName: 'foo',
        syncedToDisk: true,
      });

      AllDependencies.sync('npm:jquery', [], {
        packageName: 'npm:jquery',
        syncedToDisk: true,
        mainMapping: ['jquery', 'npm:jquery']
      });

      expect(AllDependencies.graph.nodes()).to.deep.eql([
        'foo',
        'npm:jquery',
        'jquery'
      ]);
    });

    it('should update the imports if an import is removed', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;
      desc.updateRelativePaths = function() {};

      AllDependencies.setRoots(['example-app']);

      AllDependencies.update({ packageName: 'ember' }, {
        'ember': {
          'imports': []
        }
      });

      AllDependencies.sync('example-app/app', ['ember'], {
        packageName: 'example-app',
        syncedToDisk: true
      });

      AllDependencies.sync('example-app/router', ['ember', 'npm:jquery'], {
        packageName: 'example-app',
        syncedToDisk: true
      });

      AllDependencies.sync('ember', [], {
        packageName: 'ember',
        syncedToDisk: true
      });

      AllDependencies.sync('npm:jquery', [], {
        packageName: 'npm:jquery',
        syncedToDisk: true,
        mainMapping: ['jquery', 'npm:jquery']
      });

      var modifiedDependencies = clone(denormalizedGraph);

      modifiedDependencies['example-app/router.js'].imports = [];

      AllDependencies.update(descriptor, modifiedDependencies);

      delete desc.updateRelativePaths;

      expect(AllDependencies._packages['example-app'].imports).to.deep.eql({
        'example-app/app': ['ember'],
        'example-app/router': []
      });
    });



    it('should add an import to imports if an import is added', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;
      desc.updateRelativePaths = function() {};
      var modifiedDependencies = clone(denormalizedGraph);

      modifiedDependencies['example-app/app.js'].imports = [ember, lodash];

      AllDependencies.setRoots(['example-app']);

      AllDependencies.update(descriptor, modifiedDependencies);

      delete desc.updateRelativePaths;

      expect(AllDependencies._packages['example-app'].imports).to.deep.eql({
        'example-app/app': ['ember', 'lodash'],
        'example-app/router': ['npm:jquery', 'ember']
      });
    });

    it('should update the graph if an import is added', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;
      desc.updateRelativePaths = function() {};

      AllDependencies.sync('example-app/app', ['ember'], {
        packageName: 'example-app',
        syncedToDisk: true
      });

      AllDependencies.sync('example-app/router', ['ember', 'npm:jquery'], {
        packageName: 'example-app',
        syncedToDisk: true
      });

      AllDependencies.sync('ember', [], {
        packageName: 'ember',
        syncedToDisk: true
      });

      AllDependencies.sync('npm:jquery', [], {
        packageName: 'npm:jquery',
        syncedToDisk: true,
        mainMapping: ['jquery', 'npm:jquery']
      });

      var modifiedDependencies = clone(denormalizedGraph);

      modifiedDependencies['example-app/app.js'].imports = [ember, lodash];

      AllDependencies.update(descriptor, modifiedDependencies);
      delete desc.updateRelativePaths;

      expect(AllDependencies.graph.nodes()).to.deep.eql([
        'example-app/app',
        'ember',
        'example-app/router',
        'npm:jquery',
        'jquery'
      ]);
    });
  });

  describe('for', function() {
    it('should return a graph for a package', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      var _denormalizedGraph = stripFileExtensions(denormalizedGraph);
      expect(AllDependencies.for('example-app')).to.deep.equal(new Package({
        descriptor: descriptor,
        denormalizedGraph: _denormalizedGraph,
        imports: {
          'example-app/app': ['ember'],
          'example-app/router': ['npm:jquery', 'ember']
        }
      }));
    });

    it('should return the imports for a specific file given it\'s parent', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      var imports = AllDependencies.for('example-app/router', 'example-app');
      expect(imports).to.deep.equal(['npm:jquery', 'ember']);
    });

    it('should return null if the file or package cannot be found', function() {
      AllDependencies.update(descriptor, denormalizedGraph);
      expect(AllDependencies.for('dummy/router', 'dummy')).to.eql(null);
    });
  });

  describe('synced', function() {
    it('should add an item to the synced cache if it does not exist', function() {
      AllDependencies.sync('ember/get', [], {});
      expect(AllDependencies.graph.nodes()).to.deep.eql(['ember/get']);
    });
  });

  describe('graphForEngines', function() {

    beforeEach(function() {
      AllDependencies.roots = ['example-app', 'example-app/tests'];
    });

    afterEach(function() {
      AllDependencies.roots = [];
    });

    it('should return a map of arrays containing the nodes in a subgraph with cross entry deps pruned', function() {

      AllDependencies.roots = ['example-app', 'example-app/tests'];

      AllDependencies.sync('example-app/app', ['ember'], {
        packageName: 'example-app'
      });

      AllDependencies.sync('example-app/router', ['ember'], {
        packageName: 'example-app'
      });

      AllDependencies.sync('example-app/tests/unit/app', ['example-app/app', 'ember'], {
        packageName: 'example-app/tests'
      });

      AllDependencies.sync('ember', [], {
        packageName: 'ember'
      });

      expect(AllDependencies.graphForEngines()).to.deep.eql({
        'shared-by-all': ['ember'],
        'example-app': ['example-app/router', 'ember', 'example-app/app'],
        'example-app/tests': ['example-app/tests/unit/app', 'ember']
      });
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

      var denormalized = {
        exports: {
          exported: [],
          specifiers: []
        },
        imports: [{
          'imported': [
            'default'
          ],
          'source': 'bazing/b',
          'specifiers': [
            {
              'imported': 'default',
              'kind': 'named',
              'local': 'b'
            }
          ]
        }]
      };

      AllDependencies.add(desc, 'bazing/a', denormalized);
      var pack = AllDependencies.for('bazing');

      expect(pack.denormalizedGraph).to.deep.eql({
        'bazing/a': denormalized
      });

      expect(pack.imports).to.deep.eql({
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

      var a = {
        exports: {
          exported: [],
          specifiers: []
        },
        imports: [{
          'imported': [
            'default'
          ],
          'source': 'bazing/b',
          'specifiers': [
            {
              'imported': 'default',
              'kind': 'named',
              'local': 'b'
            }
          ]
        }]
      };

      var b = {
        exports: {
          exported: [],
          specifiers: []
        },
        imports: []
      };


      AllDependencies.add(desc, 'bazing/a', a);
      AllDependencies.add(desc, 'bazing/b', b);
      var pack = AllDependencies.for('bazing');

      expect(pack.denormalizedGraph).to.deep.eql({
        'bazing/a': a,
        'bazing/b': b
      });
      expect(pack.imports).to.deep.eql({
        'bazing/a': [ 'bazing/b' ],
        'bazing/b': [ ]
      });
    });
  });
});
