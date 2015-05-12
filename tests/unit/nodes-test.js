'use strict';

var nodes = require('../../lib/nodes');
var expect = require('chai').expect;

describe('nodes', function() {
  var cwd = process.cwd();

  beforeEach(function() {
    process.chdir('./tests/fixtures/example-app');
  });

  afterEach(function() {
    process.chdir(cwd);
  });

  describe('node', function() {
    it('should produce meta info for the app', function() {
      var nodeInfo = nodes.node('example-app', ['ember', 'jQuery'], {});
      expect(nodeInfo).to.deep.eql({
        pkgPath: process.cwd(),
        pkgName: 'example-app',
        imports: ['ember', 'jQuery']
      });
    });

    it('should produce meta info for a merged item', function() {
      var nodeInfo = nodes.node('example-app-tests', ['test'], {}, 'example-app');
      expect(nodeInfo).to.deep.eql({
        pkgPath: process.cwd(),
        pkgName: 'example-app-tests',
        imports: ['test']
      });
    });
  });

  describe('leafNode', function() {
    it('should produce meta info for the app', function() {
      var leafInfo = nodes.leafNode({
        pkgName: 'example-app',
        pkgPath: null,
        parent: {
          pkgPath: process.cwd(),
          entry: 'example-app',
          imports: ['ember', 'jQuery']
        }
      });

      expect(leafInfo).to.deep.eql({
        pkgPath: process.cwd(),
        pkgName: 'example-app',
        imports: [],
        parent: {
          pkgPath: process.cwd(),
          entry: 'example-app',
          imports: ['ember', 'jQuery']
        }
      });
    });
  });

});