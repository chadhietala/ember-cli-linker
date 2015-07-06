'use strict';

var AllDependencies = require('../../lib/all-dependencies');
var Package = require('../../lib/models/package');
var Descriptor = require('../../lib/models/descriptor');
var expect = require('chai').expect;

function clone(obj) {
  var ret = {};

  Object.keys(obj).forEach(function(item)  {
    ret[item] = obj[item];
  });

  return ret;
}

function modelEquals(result, expectation) {
  Object.keys(result).forEach(function(key) {
    expect(result[key]).to.deep.equal(expectation[key]);
  });
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
  var dependencies, descriptor, ember, lodash, jquery;
  beforeEach(function () {
    AllDependencies._graph = {};
    AllDependencies._synced = {};

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


    dependencies = {
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

  function simulateSync(desc) {
    AllDependencies._synced[desc.packageName] = ['example-app/app', 'example-app/router'];
    AllDependencies._synced['ember'] = [];
    AllDependencies._synced['jquery'] = [];
  }

  describe('update', function () {
    it('should update the graph with a new Package model', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(AllDependencies._graph['example-app'] instanceof Package);
    });

    it('should wrap the descriptor in a Descriptor model', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(AllDependencies._graph['example-app'].descriptor instanceof Descriptor);
    });

    it('should add the package to the graph', function() {
      AllDependencies.update(descriptor, dependencies);
      var _graph = stripFileExtensions(dependencies);

      expect(AllDependencies._graph['example-app']).to.deep.eql(new Package({
        descriptor: new Descriptor(descriptor),
        graph: _graph,
        imports: {
          'example-app/app': ['ember'],
          'example-app/router': ['npm:jquery', 'ember']
        },
        dedupedImports: ['ember', 'npm:jquery']
      }));
    });

    it('should perform an idempotent update if the package exists', function() {
      AllDependencies.update(descriptor, dependencies);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;
      var updateRelativePathsCalled = false;

      desc.updateRelativePaths = function() {
        updateRelativePathsCalled = true;
      };

      AllDependencies.update(descriptor, dependencies);

      delete desc.updateRelativePaths;

      expect(AllDependencies._graph['example-app']).to.deep.eql(new Package({
        descriptor: new Descriptor(descriptor),
        graph: dependencies,
        imports: {
          'example-app/app': ['ember'],
          'example-app/router': ['npm:jquery', 'ember']
        },
        dedupedImports: ['ember', 'npm:jquery']
      }));

      expect(updateRelativePathsCalled).to.eql(true);
    });

    it('should update the graph if imports are removed', function() {
      AllDependencies.update(descriptor, dependencies);
      AllDependencies.update({ packageName: 'ember' }, {
        'ember': {
          'imports': []
        }
      });

      simulateSync(descriptor);
      var modifiedDependencies = clone(dependencies);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;

      desc.updateRelativePaths = function() {};
      modifiedDependencies['example-app/app.js'].imports = [];

      AllDependencies.update(descriptor, modifiedDependencies);
      delete desc.updateRelativePaths;

      expect(AllDependencies._graph['example-app'].graph).to.deep.eql(modifiedDependencies);
    });

    it('should update the imports if an import is removed', function() {
      AllDependencies.update(descriptor, dependencies);
      AllDependencies.update({ packageName: 'ember' }, {
        'ember': {
          'imports': []
        }
      });

      simulateSync(descriptor);
      var modifiedDependencies = clone(dependencies);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;

      desc.updateRelativePaths = function() {};
      modifiedDependencies['example-app/app.js'].imports = [];

      AllDependencies.update(descriptor, modifiedDependencies);
      delete desc.updateRelativePaths;

      expect(AllDependencies._graph['example-app'].imports).to.deep.eql({
        'example-app/app': [],
        'example-app/router': ['npm:jquery', 'ember']
      });
    });

    it('should not remove items from dedupedImports if something else has a pointer into that import', function() {
      AllDependencies.update(descriptor, dependencies);
      AllDependencies.update({ packageName: 'ember' }, {
        'ember': {
          'imports': []
        }
      });
      simulateSync(descriptor);
      var modifiedDependencies = clone(dependencies);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;

      desc.updateRelativePaths = function() {};
      modifiedDependencies['example-app/app.js'].imports = [];

      AllDependencies.update(descriptor, modifiedDependencies);
      delete desc.updateRelativePaths;

      expect(AllDependencies._graph['example-app'].dedupedImports).to.deep.eql(['npm:jquery', 'ember']);
    });

    it('should add to dedupedImports if an import is added', function() {
      AllDependencies.update(descriptor, dependencies);
      simulateSync(descriptor);
      var modifiedDependencies = clone(dependencies);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;

      desc.updateRelativePaths = function() {};
      modifiedDependencies['example-app/app.js'].imports = [ember, lodash];

      AllDependencies.update(descriptor, modifiedDependencies);
      delete desc.updateRelativePaths;

      expect(AllDependencies._graph['example-app'].dedupedImports).to.deep.eql(['ember', 'lodash', 'npm:jquery',]);
    });

    it('should add an import to imports if an import is added', function() {
      AllDependencies.update(descriptor, dependencies);
      simulateSync(descriptor);
      var modifiedDependencies = clone(dependencies);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;

      desc.updateRelativePaths = function() {};
      modifiedDependencies['example-app/app.js'].imports = [ember, lodash];

      AllDependencies.update(descriptor, modifiedDependencies);
      delete desc.updateRelativePaths;

      expect(AllDependencies._graph['example-app'].imports).to.deep.eql({
        'example-app/app': ['ember', 'lodash'],
        'example-app/router': ['npm:jquery', 'ember']
      });
    });

    it('should update the graph if an import is added', function() {
      AllDependencies.update(descriptor, dependencies);
      AllDependencies._synced[descriptor.packageName] = ['example-app/app', 'example-app/router'];
      AllDependencies._synced['ember'] = [];
      AllDependencies._synced['jquery'] = [];
      var modifiedDependencies = clone(dependencies);
      var desc = AllDependencies.for(descriptor.packageName).descriptor;

      desc.updateRelativePaths = function() {};
      modifiedDependencies['example-app/app.js'].imports = [ember, lodash];

      AllDependencies.update(descriptor, modifiedDependencies);
      delete desc.updateRelativePaths;

      expect(AllDependencies._graph['example-app'].graph).to.deep.eql({
        'example-app/app.js': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: [ember, lodash]
        },
        'example-app/router.js': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: [jquery, ember]
        }
      });
    });
  });

  describe('for', function() {
    it('should return a graph for a package', function() {
      AllDependencies.update(descriptor, dependencies);
      var _graph = stripFileExtensions(dependencies);
      expect(AllDependencies.for('example-app')).to.deep.equal(new Package({
        descriptor: new Descriptor(descriptor),
        graph: _graph,
        imports: {
          'example-app/app': ['ember'],
          'example-app/router': ['npm:jquery', 'ember']
        },
        dedupedImports: ['ember', 'npm:jquery']
      }));
    });

    it('should return the imports for a specific file given it\'s parent', function() {
      AllDependencies.update(descriptor, dependencies);
      var imports = AllDependencies.for('example-app/router', 'example-app');
      expect(imports).to.deep.equal(['npm:jquery', 'ember']);
    });

    it('should return null if the file or package cannot be found', function() {
      AllDependencies.update(descriptor, dependencies);
      expect(AllDependencies.for('dummy/router', 'dummy')).to.eql(null);
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
      AllDependencies.synced('ember', 'ember/get.js');
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

      var graph = {
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

      AllDependencies.add(desc, 'bazing/a', graph);
      var pack = AllDependencies.for('bazing');

      modelEquals(pack.descriptor, new Descriptor(desc));
      expect(pack.denormalizedGraph).to.deep.eql({
        'bazing/a': graph
      });

      expect(pack.dedupedImports).to.deep.eql([ 'bazing/b' ]);
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

      modelEquals(pack.descriptor, new Descriptor(desc));
      expect(pack.graph).to.deep.eql({
        'bazing/a': a,
        'bazing/b': b
      });
      expect(pack.imports).to.deep.eql({
        'bazing/a': [ 'bazing/b' ],
        'bazing/b': [ ]
      });
      expect(pack.dedupedImports).to.deep.eql([ 'bazing/b' ]);
    });
  });
});
