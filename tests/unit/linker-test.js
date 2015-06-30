'use strict';

var Linker = require('../../lib/linker');
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
          exports: {
            exported: [],
            specifiers: []
          },
          imports: [generateDefaultImport('example-app/b', 'b')]
        },
        'example-app/b': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: []
        }
      }
    }
  };
}

function generateDefaultImport(importName, local) {
  return {
    'imported': [
      'default'
    ],
    'source': importName,
    'specifiers': [
      {
        'imported': 'default',
        'kind': 'named',
        'local': local
      }
    ]
  };
}

var exprts = {
  exported: [],
  specifiers: []
};

var b = generateDefaultImport('example-app/b', 'b');
var c = generateDefaultImport('example-app/c', 'c');

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

describe('Linker', function () {
  var linker;
  var paths = walkSync('tests/fixtures/example-app/tree');

  beforeEach(function() {
    AllDependencies._synced = {};
    AllDependencies._graph = {};
    linker = new Linker(generateTrees(paths), {
      entries: ['example-app'],
      treeDescriptors: generateTreeDescriptors(paths)
    });
  });

  it('should throw if no entires are passed', function() {
    expect(function() {
      return new Linker();
    }).to.throw(/You must pass an array of entries./);
  });

  it('should throw if no tree descriptors are passed', function() {
    expect(function() {
      return new Linker('.', { entries: ['example-app'] });
    }).to.throw(/You must pass TreeDescriptors that describe the trees in the project./);
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

      linker.cacheImport(new Import({
        name: 'a',
        packageName: 'sample-package',
        type: 'npm',
        importer: 'example-app'
      }), 'example-app');

      expect(linker.importCache).to.deep.eql({
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

      linker.cacheImport(new Import({
        name: 'a',
        packageName: 'sample-package',
        type: 'npm',
        importer: 'example-app'
      }), 'example-app');

      linker.cacheImport(new Import({
        name: 'b',
        packageName: 'sample-package',
        type: 'npm',
        importer: 'example-app'
      }), 'example-app');

      expect(linker.importCache).to.deep.eql({
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
      linker.graphHashes = generateGraphHashes();

      linker.hashGraphs = function() {
        return generateGraphHashes();
      };

      var diffs = linker.diffGraph();
      expect(diffs).to.deep.eql([]);
    });

    it('should align the graph if an import is removed', function() {

      linker.graphHashes = generateGraphHashes();
      var graphHashes = linker.graphHashes;

      AllDependencies.update({ packageName: 'example-app' }, graphHashes['example-app'].graph);

      sync([
        ['example-app', 'example-app/a.js'],
        ['example-app', 'example-app/b.js']
      ]);

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {
        return ['example-app/', 'example-app/a.js'];
      };

      linker.hashGraphs = function() {
        return {
          'example-app': {
            name: 'example-app',
            hash: 'c4dedac40c806eb428edc096c4bd6bfb',
            graph: {
              'example-app/a' : {
                exports: {
                  exported: [],
                  specifiers: []
                },
                imports: []
              }
            }
          }
        };
      };

      var diffs = linker.diffGraph();

      expect(diffs).to.deep.eql(['example-app']);
      expect(AllDependencies.getSynced('example-app')).to.deep.eql(['example-app/a.js']);
      expect(AllDependencies.for('example-app').imports).to.deep.eql({
        'example-app/a': []
      });
      expect(AllDependencies.for('example-app').graph).to.deep.eql({
        'example-app/a': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: []
        }
      });
    });

    it('should align the graph if an import is added', function() {
      linker.graphHashes = generateGraphHashes();
      var graphHashes = linker.graphHashes;

      AllDependencies.update({ packageName: 'example-app' }, graphHashes['example-app'].graph);

      sync([
        ['example-app', 'example-app/a.js'],
        ['example-app', 'example-app/b.js']
      ]);

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {
        return ['example-app/', 'example-app/a.js', 'example-app/b.js', 'example-app/c.js'];
      };

      linker.hashGraphs = function() {
        return {
          'example-app': {
            name: 'example-app',
            hash: 'c4dedac40c806eb428edc096c4bd6bfb',
            graph: {
              'example-app/a' : {
                exports:exprts,
                imports: [b]
              },
              'example-app/b': {
                exports:exprts,
                imports: [c]
              },
              'example-app/c': {
                exports: exprts,
                imports: []
              }
            }
          }
        };
      };

      var diffs = linker.diffGraph();

      expect(diffs).to.deep.eql(['example-app']);
      expect(AllDependencies.for('example-app').imports).to.deep.eql({
        'example-app/a': ['example-app/b'],
        'example-app/b': ['example-app/c'],
        'example-app/c': []
      });

      expect(AllDependencies.for('example-app').graph).to.deep.eql({
        'example-app/a': { exports: exprts, imports: [b] },
        'example-app/b': { exports: exprts, imports: [c] },
        'example-app/c': { exports: exprts, imports: [] }
      });
    });

    it('should perform an idempotent operation if there edges into a dropping edge', function() {
      linker.graphHashes = generateGraphHashes();
      var graphHashes = linker.graphHashes;
      graphHashes['foobiz'] = {
        graph: {
          'foobiz/foo': {
            exports: exprts,
            imports: [b]
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

      linker.hashGraphs = function() {
        return {
          'example-app': {
            name: 'example-app',
            hash: 'c4dedac40c806eb428edc096c4bd6bfb',
            graph: {
              'example-app/a' : {
                exports: exprts,
                imports: []
              }
            }
          },
          'foobiz': linker.graphHashes.foobiz
        };
      };

      // Asserting example-app/b.js is here from the revious resolve
      expect(AllDependencies.getSynced()).to.deep.eql({
        'example-app': ['example-app/a.js', 'example-app/b.js'],
        foobiz: ['foobiz/foo.js']
      });

      var diffs = linker.diffGraph();

      expect(diffs).to.deep.eql(['example-app']);
      expect(AllDependencies.getSynced()).to.deep.eql({
        'example-app': ['example-app/a.js', 'example-app/b.js'],
        foobiz: ['foobiz/foo.js']
      });
    });

    it('should drop transitive dependency if the entry node is dropped but retain nodes with edges', function() {
      linker.graphHashes = generateGraphHashes();
      var graphHashes = linker.graphHashes;
      var ember = generateDefaultImport('ember', 'ember');
      var foo = generateDefaultImport('foobiz/foo', 'foo');
      graphHashes['example-app'].graph['example-app/a'].imports.push(ember);
      graphHashes['example-app'].graph['example-app/b'].imports.push(foo);

      graphHashes.foobiz = {
        graph: {
          'foobiz/foo': {
            exports: exprts,
            imports: [generateDefaultImport('bar/bar', 'bar')]
          }
        },
        name: 'foobiz',
        hash: 'dbd7abe86d2bf760de14681cf990eced'
      };

      graphHashes.bar = {
        graph: {
          'bar/bar': {
            exports: exprts,
            imports: [ember]
          }
        },
        name: 'bar',
        hash: '9b7c669dd11a0333039ad97cb5a92b17'
      };

      graphHashes.ember = {
        graph: {
          'ember': {
            exports: exprts,
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

      linker.hashGraphs = function() {
        return {
          'example-app': {
            name: 'example-app',
            hash: 'c4dedac40c806eb428edc096c4bd6bfb',
            graph: {
              'example-app/a' : {
                exports: exprts,
                imports: [b, ember]
              },
              'example-app/b': {
                exports: exprts,
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

      var diffs = linker.diffGraph();

      expect(diffs).to.deep.eql(['example-app']);
      expect(AllDependencies.getSynced()).to.deep.eql({
        'example-app': ['example-app/a.js', 'example-app/b.js'],
        ember: ['ember.js']
      });
    });
  });
});
