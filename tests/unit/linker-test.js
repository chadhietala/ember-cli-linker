'use strict';

var Linker = require('../../lib/linker');
var expect = require('chai').expect;
var treeMeta = require('../helpers/tree-meta');
var AllDependencies = require('../../lib/all-dependencies');
var generateTreeDescriptors = require('../helpers/generate-tree-descriptors');
var Graph = require('graphlib').Graph;

function generateGraphs() {
  return {
    'example-app':  {
      name: 'example-app',
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
  var trees;
  beforeEach(function() {
    var orderedDescs = generateTreeDescriptors(treeMeta, true);
    var descs = generateTreeDescriptors(treeMeta);
    trees = orderedDescs.map(function(desc) {
      return desc.tree;
    });
    AllDependencies.graph = new Graph();
    AllDependencies._packages = {};

    linker = new Linker(trees, {
      entries: ['example-app'],
      treeDescriptors: {
        ordered: orderedDescs,
        map: descs
      }
    });
  });

  afterEach(function() {
    trees = null;
  });

  it('should throw if no entires are passed', function() {
    expect(function() {
      return new Linker(trees);
    }).to.throw(/You must pass an array of entries./);
  });

  it('should throw if no tree descriptors are passed', function() {
    expect(function() {
      return new Linker(trees, { entries: ['example-app'] });
    }).to.throw(/You must pass TreeDescriptors that describe the trees in the project./);
  });

  describe('diffGraph', function() {
    it('should perform an idempotent diff if the graphs exist and they are the same', function() {
      linker._graphs = generateGraphs();

      linker._graphsByName = function() {
        return generateGraphs();
      };

      var diffs = linker.diffGraph();
      expect(diffs).to.deep.eql([]);
    });

    it('should align the graph if an import is removed', function() {

      linker._graphs = generateGraphs();
      var graphs = linker._graphs;

      AllDependencies.setRoots(['example-app']);
      AllDependencies.update({ packageName: 'example-app' }, graphs['example-app'].denormalizedGraph);

      AllDependencies.addNode('example-app/b', {
        packageName: 'example-app'
      });

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {};

      var exampleApp = {
        name: 'example-app',
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

      linker._graphsByName = function() {
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
      linker._graphs = generateGraphs();
      var graphs = linker._graphs;

      AllDependencies.update({ packageName: 'example-app' }, graphs['example-app'].denormalizedGraph);

      AllDependencies.for('example-app').descriptor.updateRelativePaths = function() {};

      var exampleApp = {
        name: 'example-app',
        denormalizedGraph: {
          'example-app/a' : {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: [b]
          },
          'example-app/b': {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: [c]
          },
          'example-app/c': {
            exports: {
              exported: [],
              specifiers: []
            },
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

      linker._graphsByName = function() {
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
      linker._graphs = generateGraphs();
      var graphs = linker._graphs;
      graphs['foobiz'] = {
        denormalizedGraph: {
          'foobiz/foo': {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: [b]
          }
        },
        name: 'foobiz'
      };

      updatePackages([
        [{packageName: 'foobiz'}, graphs.foobiz.denormalizedGraph],
        [{packageName: 'example-app'}, graphs['example-app'].denormalizedGraph]
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

      linker._graphsByName = function() {
        return {
          'example-app': exampleApp,
          'foobiz': linker._graphs.foobiz
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
      linker._graphs = generateGraphs();
      var graphs = linker._graphs;
      var ember = generateDefaultImport('ember', 'ember');
      var foo = generateDefaultImport('foobiz/foo', 'foo');
      graphs['example-app'].denormalizedGraph['example-app/a'].imports.push(ember);
      graphs['example-app'].denormalizedGraph['example-app/b'].imports.push(foo);

      AllDependencies.setRoots(['example-app']);
      graphs.foobiz = {
        denormalizedGraph: {
          'foobiz/foo': {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: [generateDefaultImport('bar/bar', 'bar')]
          }
        },
        name: 'foobiz'
      };

      graphs.bar = {
        denormalizedGraph: {
          'bar/bar': {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: [ember]
          }
        },
        name: 'bar'
      };

      graphs.ember = {
        denormalizedGraph: {
          'ember': {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: []
          }
        },
        name: 'ember'
      };

      updatePackages([
        [{packageName: 'ember'}, graphs.ember.denormalizedGraph],
        [{packageName: 'example-app'}, graphs['example-app'].denormalizedGraph],
        [{packageName: 'foobiz'}, graphs.foobiz.denormalizedGraph],
        [{packageName: 'bar'}, graphs.bar.denormalizedGraph]
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
        denormalizedGraph: {
          'example-app/a' : {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: [b, ember]
          },
          'example-app/b': {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: []
          }
        }
      };

      linker._graphsByName = function() {
        return {
          'example-app': exampleApp,
          foobiz: graphs.foobiz,
          bar: graphs.bar,
          ember: graphs.ember
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

      expect(AllDependencies.graph.nodes()).to.deep.eql(['example-app/a', 'ember', 'example-app/b']);
    });
  });
});
