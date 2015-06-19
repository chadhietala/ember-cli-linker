'use strict';

var Package = require('../../lib/models/package');
var expect = require('chai').expect;

describe('Package', function () {

  var a = {
    'imported': [
      'default'
    ],
    'source': 'a',
    'specifiers': [
      {
        'imported': 'default',
        'kind': 'named',
        'local': 'a'
      }
    ]
  };

  var b = {
    'imported': [
      'default'
    ],
    'source': 'b',
    'specifiers': [
      {
        'imported': 'default',
        'kind': 'named',
        'local': 'b'
      }
    ]
  };

  var c = {
    'imported': [
      'default'
    ],
    'source': 'c',
    'specifiers': [
      {
        'imported': 'default',
        'kind': 'named',
        'local': 'c'
      }
    ]
  };

  var d = {
    'imported': [
      'default'
    ],
    'source': 'd',
    'specifiers': [
      {
        'imported': 'default',
        'kind': 'named',
        'local': 'd'
      }
    ]
  };

  describe('flattenImports',  function() {
    it('should flatten the map of imports', function() {
      var expectation = Package.flattenImports({
        'foo.js': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: [a, b],
        },
        'bar.js': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: [c, d]
        }
      });

      expect(expectation).to.deep.eql({
        'foo': ['a', 'b'],
        'bar': ['c', 'd']
      });
    });
  });

  describe('removeExports',  function() {
    it('should remove exports from imports', function() {
      var imports = ['foo', 'bar', 'exports'];
      expect(Package.removeExports(imports)).to.deep.eql(['foo', 'bar']);
    });
  });

  describe('dedupedImports',  function() {
    it('should remove duplicates from an import map', function() {
      var imports = Package.flattenImports({
        'foo.js': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: [a, b, c, d]
        },
        'bar.js': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: [c, d]
        }
      });

      expect(Package.dedupeImports(imports)).to.deep.eql(['a', 'b', 'c', 'd']);
    });
  });

  describe('removeFileExtensionsFromGraph',  function() {
    it('should remove file extension from graph', function() {

      var graph = Package.removeFileExtensionsFromGraph({
        'foo.js': {
          imports: ['a', 'b', 'c', 'd'],
          exports: []
        },
        'bar.js': {
          imports: ['c', 'd'],
          exports: []
        }
      });

      expect(graph).to.deep.eql({
        'foo': {
          imports: ['a', 'b', 'c', 'd'],
          exports: []
        },
        'bar': {
          imports: ['c', 'd'],
          exports: []
        }
      });
    });
  });

  describe('addToGraph',  function() {
    it('it should add to an existing graph', function() {
      var pack = new Package({
        graph: {
          'b': {
            imports: [],
            exports: []
          }
        }
      });

      pack.addToGraph('a', {imports: ['b'], exports: []});

      expect(pack.graph).to.deep.eql({
        a: {
          imports: ['b'],
          exports: []
        },
        b: {
          imports: [],
          exports: []
        }
      });
    });
  });

  describe('addToDedupedImports',  function() {
    it('it should add to the existing dedupedImports graph', function() {
      var pack = new Package({
        dedupedImports: ['a', 'b']
      });

      pack.addToDedupedImports(['a', 'b', 'c']);
      expect(pack.dedupedImports).to.deep.eql(['a', 'b', 'c']);
    });
  });

  describe('addToImports',  function() {
    it('it should add to the existing imports graph', function() {
      var pack = new Package({
        imports: {
          'a': ['b']
        }
      });

      pack.addToImports('b', ['c']);
      expect(pack.imports).to.deep.eql({
        a: ['b'],
        b: ['c']
      });
    });
  });

  describe('updateDependencies',  function() {
    it('it should add to the existing imports graph', function() {
      var called = false;
      var pack = new Package({
        descriptor: {
          updateRelativePaths: function() {
            called = true;
          }
        },
        graph: {
          'a.js': {
            exports: {
              exported: [],
              specifiers: []
            },
            imports: [b]
          }
        },
        imports: {
          'a': ['b']
        }
      });

      var graph = {
        'a.js': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: [b]
        },
        'b.js': {
          exports: {
            exported: [],
            specifiers: []
          },
          imports: [c]
        }
      };

      pack.updateDependencies(graph);

      expect(pack.imports).to.deep.eql({
        a: ['b'],
        b: ['c']
      });

      expect(pack.graph).to.deep.eql(graph);
      expect(pack.dedupedImports).to.deep.eql(['b', 'c']);
    });
  });
});