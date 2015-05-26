'use strict';
var Dependency = require('../../lib/models/dependency');
var expect = require('chai').expect;

describe('dependency', function() {

  beforeEach(function() {
    this.dependency = new Dependency();
  });

  afterEach(function() {
    this.dependency = null;
  });

  it('should add an import the graph', function() {
    this.dependency.addToGraph('example-app/app', {
      imports: ['exports', 'ember'],
      exports: ['default']
    });
    expect(this.dependency.graph).to.deep.eql({
      'example-app/app': {
        imports: ['exports', 'ember'],
        exports: ['default']
      }
    });
  });

  it('should add to dedupedImports', function() {
    this.dependency.addToDedupedImports(['ember', 'jquery']);
    expect(this.dependency.dedupedImports).to.deep.eql(['ember', 'jquery']);
    this.dependency.addToDedupedImports(['ember', 'lodash']);
    expect(this.dependency.dedupedImports).to.deep.eql(['ember', 'jquery', 'lodash']);
  });

  it('should add to imports', function() {
    this.dependency.addToImports('example-app/app', ['ember', 'jquery']);
    expect(this.dependency.imports).to.deep.eql({
      'example-app/app': ['ember', 'jquery']
    });
  });
});