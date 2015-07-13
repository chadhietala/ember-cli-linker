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

  describe('addToDenormalizedGraph',  function() {
    it('it should add to an existing graph', function() {
      var pack = new Package({
        denormalizedGraph: {
          'b': {
            imports: [],
            exports: []
          }
        }
      });

      pack.addToDenormalizedGraph('a', {imports: ['b'], exports: []});

      expect(pack.denormalizedGraph).to.deep.eql({
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

      expect(pack.denormalizedGraph).to.deep.eql(graph);
    });
  });

  describe('getName', function() {
    it('should return the package name', function() {
      expect(Package.getName('foo/bar/baz')).to.eql('foo');
    });

    it('should return a scoped package name', function() {
      expect(Package.getName('@linkedin/foo/bar')).to.eql('@linkedin/foo');
    });

    it('tests should fall back to the passed tests package', function() {
      expect(Package.getName('foo/tests/bar-test', 'foo/tests')).to.eql('foo/tests');
    });
  });
});
