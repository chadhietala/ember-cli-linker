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
    it('should perform an idempotent diff if the graphHahes exist and hashes are the same', function() {
      prePackager.graphHashes = generateGraphHashes();

      prePackager.hashGraphs = function() {
        return generateGraphHashes();
      };

      var diffs = prePackager.diffGraph();
      expect(diffs).to.deep.eql([]);
    });

    it('should align the graph if an import is removed', function() {

      prePackager.graphHashes = generateGraphHashes();
      
      AllDependencies.update({
        root: process.cwd(),
        nodeModulesPath: process.cwd() + path.sep + 'node_modules',
        packageName: 'example-app',
        pkg: { name: 'example-app', version: '1.0.0' },
        relativePaths: ['example-app/', 'example-app/a.js', 'example-app/b.js'],
        parent: null,
        srcDir: process.cwd() + path.sep + 'tmp_foo'
      }, prePackager.graphHashes['example-app'].graph);

      AllDependencies.synced('example-app', 'example-app/a.js');
      AllDependencies.synced('example-app', 'example-app/b.js');

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
      
      AllDependencies.update({
        root: process.cwd(),
        nodeModulesPath: process.cwd() + path.sep + 'node_modules',
        packageName: 'example-app',
        pkg: { name: 'example-app', version: '1.0.0' },
        relativePaths: ['example-app/', 'example-app/a.js', 'example-app/b.js'],
        parent: null,
        srcDir: process.cwd() + path.sep + 'tmp_foo'
      }, prePackager.graphHashes['example-app'].graph);

      AllDependencies.synced('example-app', 'example-app/a.js');
      AllDependencies.synced('example-app', 'example-app/b.js');

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
      prePackager.graphHashes['foobiz'] = {
        graph: {
          'foobiz/foo': {
            imports: ['example-app/b']
          }
        },
        name: 'foobiz',
        hash: 'dbd7abe86d2bf760de14681cf990eced'
      };
      
      AllDependencies.update({
        root: process.cwd(),
        nodeModulesPath: process.cwd() + path.sep + 'node_modules',
        packageName: 'example-app',
        pkg: { name: 'example-app', version: '1.0.0' },
        relativePaths: ['example-app/', 'example-app/a.js', 'example-app/b.js'],
        parent: null,
        srcDir: process.cwd() + path.sep + 'tmp_foo'
      }, prePackager.graphHashes['example-app'].graph);

      AllDependencies.update({
        root: process.cwd() + path.sep + 'node_modules' + path.sep + 'foobiz',
        nodeModulesPath: process.cwd() + path.sep + 'node_modules' + path.sep + 'foobiz' + path.sep + 'node_modules',
        packageName: 'foobiz',
        pkg: { name: 'foobiz', version: '1.0.0' },
        relativePaths: ['foobiz/', 'foobiz/foo.js'],
        parent: null,
        srcDir: process.cwd() + path.sep + 'tmp_foobiz'
      }, prePackager.graphHashes['foobiz'].graph);

      AllDependencies.synced('example-app', 'example-app/a.js');
      AllDependencies.synced('example-app', 'example-app/b.js');
      AllDependencies.synced('foobiz', 'foobiz/foo.js');

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
          'foobiz': {
            name: 'foobiz',
            hash: 'dbd7abe86d2bf760de14681cf990eced',
            graph: {
              'foobiz/foo': {
                imports: ['example-app/b']
              }
            }
          }
        };
      };

      // Asserting example-app/b.js is here from the revious resolve 
      expect(AllDependencies.getSynced()).to.deep.eql({
        'example-app': ['example-app/a.js', 'example-app/b.js'],
        foobiz: ['foobiz/foo.js']
      });

      var diffs = prePackager.diffGraph();

      // Simulating the edge being placed back in by resolving foobiz/foo
      AllDependencies.synced('example-app', 'example-app/b.js');

      expect(diffs).to.deep.eql(['example-app']);
      expect(AllDependencies.getSynced()).to.deep.eql({
        'example-app': ['example-app/a.js', 'example-app/b.js'],
        foobiz: ['foobiz/foo.js']
      });
    });
  });
});