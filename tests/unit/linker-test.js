'use strict';

var Linker = require('../../lib/linker');
var expect = require('chai').expect;
var walkSync = require('walk-sync');
var generateTrees = require('../helpers/generate-trees');
var AllDependencies = require('../../lib/all-dependencies');
var generateTreeDescriptors = require('../helpers/generate-tree-descriptors');
var Graph = require('graphlib').Graph;

function generateGraphHashes() {
  return {
    'example-app':  {
      name: 'example-app',
      hash: '2ed8ffd474b4b640a931915d6b40f6f6',
      denormalizedGraph: {
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

function updatePackages(packages) {
  packages.forEach(function(pack) {
    AllDependencies.update.apply(AllDependencies, pack);
  });
}

describe('Linker', function () {
  var linker;
  var paths = walkSync('tests/fixtures/example-app/tree');

  beforeEach(function() {
    AllDependencies.graph = new Graph();
    AllDependencies._packages = {};
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

  describe('decorateTreeDescriptors', function() {

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

      AllDependencies.setRoots(['example-app']);
      AllDependencies.update({ packageName: 'example-app' }, graphHashes['example-app'].denormalizedGraph);

      AllDependencies.addNode('example-app/b', {
        packageName: 'example-app'
      });


      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {};

      var exampleApp = {
        name: 'example-app',
        hash: 'c4dedac40c806eb428edc096c4bd6bfb',
        denormalizedGraph: {
          'example-app/a' : {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: []
          }
        }
      };

      linker.hashGraphs = function() {
        return {
          'example-app': exampleApp
        };
      };

      var diffs = linker.diffGraph();


      expect(diffs).to.deep.eql([exampleApp]);
      AllDependencies.update({packageName: 'example-app'}, exampleApp.denormalizedGraph);

      AllDependencies.addNode('example-app/a', {
        packageName: 'example-app'
      });

      expect(AllDependencies.graph.nodes()).to.deep.eql(['example-app/a']);
      expect(AllDependencies.for('example-app').imports).to.deep.eql({
        'example-app/a': []
      });
      expect(AllDependencies.for('example-app').denormalizedGraph).to.deep.eql({
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

      AllDependencies.update({ packageName: 'example-app' }, graphHashes['example-app'].denormalizedGraph);

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {};

      var exampleApp = {
        name: 'example-app',
        hash: 'c4dedac40c806eb428edc096c4bd6bfb',
        denormalizedGraph: {
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
      };

      AllDependencies.sync('example-app/a', ['example-app/b'], {
        packageName: 'example-app'
      });

      AllDependencies.sync('example-app/b', ['example-app/c'], {
        packageName: 'example-app'
      });

      AllDependencies.sync('example-app/c', [], {
        packageName: 'example-app'
      });

      linker.hashGraphs = function() {
        return {
          'example-app': exampleApp
        };
      };

      var diffs = linker.diffGraph();

      expect(diffs).to.deep.eql([exampleApp]);
      AllDependencies.update({packageName: 'example-app'}, exampleApp.denormalizedGraph);
      expect(AllDependencies.for('example-app').imports).to.deep.eql({
        'example-app/a': ['example-app/b'],
        'example-app/b': ['example-app/c'],
        'example-app/c': []
      });

      expect(AllDependencies.for('example-app').denormalizedGraph).to.deep.eql({
        'example-app/a': { exports: exprts, imports: [b] },
        'example-app/b': { exports: exprts, imports: [c] },
        'example-app/c': { exports: exprts, imports: [] }
      });

      expect(AllDependencies.graph.nodes()).to.deep.eql([
        'example-app/a',
        'example-app/b',
        'example-app/c'
      ]);
    });

    it('should perform an idempotent operation if there edges into a dropping edge', function() {
      linker.graphHashes = generateGraphHashes();
      var graphHashes = linker.graphHashes;
      graphHashes['foobiz'] = {
        denormalizedGraph: {
          'foobiz/foo': {
            exports: exprts,
            imports: [b]
          }
        },
        name: 'foobiz',
        hash: 'dbd7abe86d2bf760de14681cf990eced'
      };

      updatePackages([
        [{packageName: 'foobiz'}, graphHashes.foobiz.denormalizedGraph],
        [{packageName: 'example-app'}, graphHashes['example-app'].denormalizedGraph]
      ]);

      AllDependencies.sync('example-app/a', ['example-app/b'], {
        packageName: 'example-app'
      });

      AllDependencies.sync('example-app/b', [], {
        packageName: 'example-app'
      });

      AllDependencies.sync('foobiz/foo', ['example-app/b'], {
        packageName: 'foobiz'
      });


      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {};

      var exampleApp = {
        name: 'example-app',
        hash: 'c4dedac40c806eb428edc096c4bd6bfb',
        graph: {
          'example-app/a' : {
            exports: exprts,
            imports: []
          }
        }
      };

      linker.hashGraphs = function() {
        return {
          'example-app': exampleApp,
          'foobiz': linker.graphHashes.foobiz
        };
      };

      expect(AllDependencies.graph.nodes()).to.deep.eql([
        'example-app/a',
        'example-app/b',
        'foobiz/foo'
      ]);

      var diffs = linker.diffGraph();

      expect(diffs).to.deep.eql([exampleApp]);

      expect(AllDependencies.graph.nodes()).to.deep.eql([
        'example-app/a',
        'example-app/b',
        'foobiz/foo'
      ]);
    });

    it('should drop transitive dependency if the entry node is dropped but retain nodes with edges', function() {
      linker.graphHashes = generateGraphHashes();
      var graphHashes = linker.graphHashes;
      var ember = generateDefaultImport('ember', 'ember');
      var foo = generateDefaultImport('foobiz/foo', 'foo');
      graphHashes['example-app'].denormalizedGraph['example-app/a'].imports.push(ember);
      graphHashes['example-app'].denormalizedGraph['example-app/b'].imports.push(foo);

      AllDependencies.setRoots(['example-app']);
      graphHashes.foobiz = {
        denormalizedGraph: {
          'foobiz/foo': {
            exports: exprts,
            imports: [generateDefaultImport('bar/bar', 'bar')]
          }
        },
        name: 'foobiz',
        hash: 'dbd7abe86d2bf760de14681cf990eced'
      };

      graphHashes.bar = {
        denormalizedGraph: {
          'bar/bar': {
            exports: exprts,
            imports: [ember]
          }
        },
        name: 'bar',
        hash: '9b7c669dd11a0333039ad97cb5a92b17'
      };

      graphHashes.ember = {
        denormalizedGraph: {
          'ember': {
            exports: exprts,
            imports: []
          }
        },
        name: 'ember',
        hash: 'daljk3325jdksl4ajk324923498hjadn32'
      };

      updatePackages([
        [{packageName: 'ember'}, graphHashes.ember.denormalizedGraph],
        [{packageName: 'example-app'}, graphHashes['example-app'].denormalizedGraph],
        [{packageName: 'foobiz'}, graphHashes.foobiz.denormalizedGraph],
        [{packageName: 'bar'}, graphHashes.bar.denormalizedGraph]
      ]);

      AllDependencies.sync('example-app/a', ['ember', 'example-app/b'], {
        packageName: 'example-app'
      });

      AllDependencies.sync('ember', [], {
        packageName: 'ember'
      });

      AllDependencies.sync('example-app/b', ['foobiz/foo'], {
        packageName: 'example-app'
      });

      AllDependencies.sync('foobiz/foo', ['bar/bar'], {
        packageName: 'foobiz'
      });

      AllDependencies.sync('bar/bar', ['ember'], {
        packageName: 'bar'
      });

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {};

      var exampleApp = {
        name: 'example-app',
        hash: 'c4dedac40c806eb428edc096c4bd6bfb',
        denormalizedGraph: {
          'example-app/a' : {
            exports: exprts,
            imports: [b, ember]
          },
          'example-app/b': {
            exports: exprts,
            imports: []
          }
        }
      };

      linker.hashGraphs = function() {
        return {
          'example-app': exampleApp,
          foobiz: graphHashes.foobiz,
          bar: graphHashes.bar,
          ember: graphHashes.ember
        };
      };

      expect(AllDependencies.graph.nodes()).to.deep.eql([
        'example-app/a',
        'ember',
        'example-app/b',
        'foobiz/foo',
        'bar/bar'
      ]);

      var diffs = linker.diffGraph();
      expect(diffs).to.deep.eql([exampleApp]);

      AllDependencies.update({packageName: 'example-app' }, exampleApp.denormalizedGraph);

      expect(AllDependencies.graph.nodes()).to.deep.eql(['example-app/a', 'ember', 'example-app/b', 'bar/bar']);
    });
  });
});
