'use strict';

var PrePackager = require('../../lib/pre-packager');
var expect = require('chai').expect;
var walkSync = require('walk-sync');
var generateTrees = require('../helpers/generate-trees');
var AllDependencies = require('../../lib/all-dependencies');
var generateTreeDescriptors = require('../helpers/generate-tree-descriptors');
var path = require('path');
var Import = require('../../lib/models/import');

function generateGraphHashes() {
  return {
    'example-app':  {
      name: 'example-app',
      hash: '2ed8ffd474b4b640a931915d6b40f6f6',
      graph: {
        'example-app/a' : {
          imports: ['example-app/b']
        },
        'example-app/b': {
          imports: []
        }
      }
    }
  };
}

function sync(packages) {
  packages.forEach(function(pack) {
    AllDependencies.synced.apply(AllDependencies, pack);
  });
}

function updatePackages(packages) {
  packages.forEach(function(pack) {
    AllDependencies.update.apply(AllDependencies, pack);
  });
}

describe('PrePackager', function () {
  var prePackager;
  var paths = walkSync('tests/fixtures/example-app/tree');

  beforeEach(function() {
    AllDependencies._synced = {};
    AllDependencies._graph = {};
    prePackager = new PrePackager(generateTrees(paths), {
      entries: ['example-app'],
      treeDescriptors: generateTreeDescriptors(paths)
    });
  });

  it('should throw if no entires are passed', function() {
    expect(function() {
      return new PrePackager();
    }).to.throw(/You must pass an array of entries./);
  });

  it('should throw if no tree descriptors are passed', function() {
    expect(function() {
      return new PrePackager('.', { entries: ['example-app'] });
    }).to.throw(/You must pass TreeDescriptors that describe the trees in the project./);
  });

  it('should setup graphHashes if they do not exist', function() {
    prePackager.hashGraphs = function() {
      return generateGraphHashes();
    };

    var diffs = prePackager.diffGraph();

    expect(diffs).to.deep.eql([]);
    expect(prePackager.graphHashes).to.deep.eql(generateGraphHashes());
  });

  describe('cacheImport', function() {
    it('should cache an import by its type', function() {
      AllDependencies.update({
        root: process.cwd(),
        nodeModulesPath: process.cwd() + path.sep + 'node_modules',
        packageName: 'example-app',
        pkg: { name: 'example-app', version: '1.0.0' },
        relativePaths: ['example-app/', 'example-app/a.js', 'example-app/b.js'],
        parent: null,
        srcDir: process.cwd() + path.sep + 'tmp_foo'
      }, {
        'foo': {
          imports: ['npm:a']
        }
      });

      prePackager.cacheImport(new Import({
        name: 'a',
        packageName: 'sample-package',
        type: 'npm',
        importer: 'example-app'
      }), 'example-app');

      expect(prePackager.importCache).to.deep.eql({
        npm: {
          'sample-package': {
            imports: [new Import({importer: 'example-app', name: 'a', packageName: 'sample-package', type: 'npm'})],
            parent: AllDependencies.for('example-app')
          }
        }
      });      
    });

    it('should update the existing import cache with a new import', function() {
      AllDependencies.update({
        root: process.cwd(),
        nodeModulesPath: process.cwd() + path.sep + 'node_modules',
        packageName: 'example-app',
        pkg: { name: 'example-app', version: '1.0.0' },
        relativePaths: ['example-app/', 'example-app/a.js', 'example-app/b.js'],
        parent: null,
        srcDir: process.cwd() + path.sep + 'tmp_foo'
      }, {
        'foo': {
          imports: ['npm:a', 'npm:b']
        }
      });

      prePackager.cacheImport(new Import({
        name: 'a',
        packageName: 'sample-package',
        type: 'npm',
        importer: 'example-app'
      }), 'example-app');

      prePackager.cacheImport(new Import({
        name: 'b',
        packageName: 'sample-package',
        type: 'npm',
        importer: 'example-app'
      }), 'example-app');

      expect(prePackager.importCache).to.deep.eql({
        npm: {
          'sample-package': {
            imports: [
              new Import({importer: 'example-app', name: 'a', packageName: 'sample-package', type: 'npm'}),
              new Import({importer: 'example-app', name: 'b', packageName: 'sample-package', type: 'npm'})
            ],
            parent: AllDependencies.for('example-app')
          }
        }
      });
    });
  });

  describe('diffGraph', function() {
    it('should perform an idempotent diff if the graphHashes exist and hashes are the same', function() {
      prePackager.graphHashes = generateGraphHashes();

      prePackager.hashGraphs = function() {
        return generateGraphHashes();
      };

      var diffs = prePackager.diffGraph();
      expect(diffs).to.deep.eql([]);
    });

    it('should align the graph if an import is removed', function() {

      prePackager.graphHashes = generateGraphHashes();
      var graphHashes = prePackager.graphHashes;

      AllDependencies.update({ packageName: 'example-app' }, graphHashes['example-app'].graph);

      sync([
        ['example-app', 'example-app/a.js'],
        ['example-app', 'example-app/b.js']
      ]);

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {
        return ['example-app/', 'example-app/a.js'];
      };

      prePackager.hashGraphs = function() {
        return {
          'example-app': {
            name: 'example-app',
            hash: 'c4dedac40c806eb428edc096c4bd6bfb',
            graph: {
              'example-app/a' : {
                imports: []
              }
            }
          }
        };
      };

      var diffs = prePackager.diffGraph();

      expect(diffs).to.deep.eql(['example-app']);
      expect(AllDependencies.getSynced('example-app')).to.deep.eql(['example-app/a.js']);
      expect(AllDependencies.for('example-app').imports).to.deep.eql({
        'example-app/a': []
      });
      expect(AllDependencies.for('example-app').graph).to.deep.eql({
        'example-app/a': { imports: [] }
      });
    });

    it('should align the graph if an import is added', function() {
      prePackager.graphHashes = generateGraphHashes();
      var graphHashes = prePackager.graphHashes;
      
      AllDependencies.update({ packageName: 'example-app' }, graphHashes['example-app'].graph);

      sync([
        ['example-app', 'example-app/a.js'],
        ['example-app', 'example-app/b.js']
      ]);

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {
        return ['example-app/', 'example-app/a.js', 'example-app/b.js', 'example-app/c.js'];
      };

      prePackager.hashGraphs = function() {
        return {
          'example-app': {
            name: 'example-app',
            hash: 'c4dedac40c806eb428edc096c4bd6bfb',
            graph: {
              'example-app/a' : {
                imports: ['example-app/b']
              },
              'example-app/b': {
                imports: ['example-app/c']
              },
              'example-app/c': {
                imports: []
              }
            }
          }
        };
      };

      var diffs = prePackager.diffGraph();

      expect(diffs).to.deep.eql(['example-app']);
      expect(AllDependencies.for('example-app').imports).to.deep.eql({
        'example-app/a': ['example-app/b'],
        'example-app/b': ['example-app/c'],
        'example-app/c': []
      });
      
      expect(AllDependencies.for('example-app').graph).to.deep.eql({
        'example-app/a': { imports: ['example-app/b'] },
        'example-app/b': { imports: ['example-app/c'] },
        'example-app/c': { imports: [] }
      });
    });

    it('should perform an idempotent operation if there edges into a dropping edge', function() {
      prePackager.graphHashes = generateGraphHashes();
      var graphHashes = prePackager.graphHashes;
      graphHashes['foobiz'] = {
        graph: {
          'foobiz/foo': {
            imports: ['example-app/b']
          }
        },
        name: 'foobiz',
        hash: 'dbd7abe86d2bf760de14681cf990eced'
      };
      
      updatePackages([
        [{packageName: 'foobiz'}, graphHashes.foobiz.graph],
        [{packageName: 'example-app'}, graphHashes['example-app'].graph]
      ]);

      sync([
        ['example-app', 'example-app/a.js'],
        ['example-app', 'example-app/b.js'],
        ['foobiz', 'foobiz/foo.js']
      ]);

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {
        return ['example-app/', 'example-app/a.js'];
      };

      prePackager.hashGraphs = function() {
        return {
          'example-app': {
            name: 'example-app',
            hash: 'c4dedac40c806eb428edc096c4bd6bfb',
            graph: {
              'example-app/a' : {
                imports: []
              }
            }
          },
          'foobiz': prePackager.graphHashes.foobiz
        };
      };

      // Asserting example-app/b.js is here from the revious resolve 
      expect(AllDependencies.getSynced()).to.deep.eql({
        'example-app': ['example-app/a.js', 'example-app/b.js'],
        foobiz: ['foobiz/foo.js']
      });

      var diffs = prePackager.diffGraph();

      expect(diffs).to.deep.eql(['example-app']);
      expect(AllDependencies.getSynced()).to.deep.eql({
        'example-app': ['example-app/a.js', 'example-app/b.js'],
        foobiz: ['foobiz/foo.js']
      });
    });

    it('should drop transitive dependency if the entry node is dropped but retain nodes with edges', function() {
      prePackager.graphHashes = generateGraphHashes();
      var graphHashes = prePackager.graphHashes;
      graphHashes['example-app'].graph['example-app/a'].imports.push('ember');
      graphHashes['example-app'].graph['example-app/b'].imports.push('foobiz/foo');

      graphHashes['foobiz'] = {
        graph: {
          'foobiz/foo': {
            imports: ['bar/bar']
          }
        },
        name: 'foobiz',
        hash: 'dbd7abe86d2bf760de14681cf990eced'
      };

      graphHashes['bar'] = {
        graph: {
          'bar/bar': {
            imports: ['ember']
          }
        },
        name: 'bar',
        hash: '9b7c669dd11a0333039ad97cb5a92b17'
      };

      graphHashes['ember'] = {
        graph: {
          'ember': {
            imports: []
          }
        },
        name: 'ember',
        hash: 'daljk3325jdksl4ajk324923498hjadn32'
      };

      updatePackages([
        [{packageName: 'ember'}, graphHashes.ember.graph],
        [{packageName: 'example-app'}, graphHashes['example-app'].graph],
        
        [{packageName: 'foobiz'}, graphHashes.foobiz.graph],
        [{packageName: 'bar'}, graphHashes.bar.graph]
      ]);

      sync([
        ['example-app', 'example-app/a.js'],
        ['ember', 'ember.js'],
        ['example-app', 'example-app/b.js'],
        ['foobiz', 'foobiz/foo.js'],
        ['bar', 'bar/bar.js']
      ]);

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {};

      prePackager.hashGraphs = function() {
        return {
          'example-app': {
            name: 'example-app',
            hash: 'c4dedac40c806eb428edc096c4bd6bfb',
            graph: {
              'example-app/a' : {
                imports: ['example-app/b', 'ember']
              },
              'example-app/b': {
                imports: []
              }
            }
          },
          foobiz: graphHashes.foobiz,
          bar: graphHashes.bar,
          ember: graphHashes.ember
        };
      };

      expect(AllDependencies.getSynced()).to.deep.eql({
        'example-app': ['example-app/a.js', 'example-app/b.js'],
        ember: ['ember.js'],
        foobiz: ['foobiz/foo.js'],
        bar: ['bar/bar.js']
      });

      var diffs = prePackager.diffGraph();

      expect(diffs).to.deep.eql(['example-app']);
      expect(AllDependencies.getSynced()).to.deep.eql({
        'example-app': ['example-app/a.js', 'example-app/b.js'],
        ember: ['ember.js']
      });
    });
  });
});