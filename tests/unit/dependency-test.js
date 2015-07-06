'use strict';
var Package = require('../../lib/models/package');
var expect = require('chai').expect;

describe('Package', function() {

  beforeEach(function() {
    this.pack = new Package();
  });

  afterEach(function() {
    this.pack = null;
  });

  it('should add an import the graph', function() {
    this.pack.addToDenormalizedGraph('example-app/app', {
      imports: ['exports', 'ember'],
      exports: ['default']
    });
    expect(this.pack.denormalizedGraph).to.deep.eql({
      'example-app/app': {
        imports: ['exports', 'ember'],
        exports: ['default']
      }
    });
  });

  it('should add to dedupedImports', function() {
    this.pack.addToDedupedImports(['ember', 'jquery']);
    expect(this.pack.dedupedImports).to.deep.eql(['ember', 'jquery']);
    this.pack.addToDedupedImports(['ember', 'lodash']);
    expect(this.pack.dedupedImports).to.deep.eql(['ember', 'jquery', 'lodash']);
  });

  it('should add to imports', function() {
    this.pack.addToImports('example-app/app', ['ember', 'jquery']);
    expect(this.pack.imports).to.deep.eql({
      'example-app/app': ['ember', 'jquery']
    });
  });
});
