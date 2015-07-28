'use strict';

var expect = require('chai').expect;
var AllDependencies = require('../../lib/all-dependencies');
var sinon = require('sinon');
var path = require('path');
var fs = require('fs-extra');
var rewire = require('rewire');



describe('npm unit', function() {
  var resolver;
  beforeEach(function() {
    resolver = rewire('../../lib/resolvers/npm');
    sinon.stub(AllDependencies, 'getNodeMeta', function() {
      return { packageName: 'ember-moment' };
    });
  });

  afterEach(function() {
    resolver = null;
    AllDependencies.getNodeMeta.restore();
  });

  describe('_moduleBaseDir', function() {

    it('should return the module base directory', function() {
      var basedir = resolver._moduleBaseDir('example-app/node_modules/ember-moment/node_modules/moment/index.js', 'moment');

      expect(basedir).to.eql('example-app/node_modules/ember-moment/node_modules/moment');

    });

    it('should pass through if already resolved', function() {
      var basedir = resolver._moduleBaseDir('example-app/node_modules/ember-moment/node_modules/moment', 'moment');

      expect(basedir).to.eql('example-app/node_modules/ember-moment/node_modules/moment');

    });
  });

  describe('createStub', function() {
    it('should create an AMD stub', function() {
      expect(
        resolver.createStub(['npm:foobar', 'npm:baz'])
      ).to.eql(fs.readFileSync('./tests/assertions/stub.js', 'utf8'));
    });
  });

  describe('hashesValid', function() {
    beforeEach(function() {
      resolver.__set__('hashForDep', function(pack) {
        if (pack === 'foo') {
          return 'fdlkdsljk43kljr3wkl324k';
        } else {
          return '22323k23jklj213jk23kl213lk';
        }
      });
      sinon.stub(resolver, 'hashPackages', function() {
        return { foo: 'fdlkdsljk43kljr3wkl324k', bar: '22323k23jklj213jk23kl213lk' };
      });
    });

    afterEach(function() {
      resolver.hashPackages.restore();
    });

    it('should return true if the current and new hashes are the same', function() {
      var areValid = resolver.hashesValid({
        foo: 'fdlkdsljk43kljr3wkl324k',
        bar: '22323k23jklj213jk23kl213lk'
      }, ['foo', 'bar']);

      expect(areValid).to.be.ok;
    });

    it('should return false if the current and new hashes are not the same', function() {
      var areValid = resolver.hashesValid({
        foo: 'adjhkssfhkjfsdjkhjkfdskjdfs',
        bar: '22323k23jklj213jk23kl213lk'
      }, ['foo', 'bar']);

      expect(areValid).to.not.be.ok;
    });
  });

  describe('moduleDirs', function() {
    var cwd = process.cwd();
    beforeEach(function() {
      process.chdir('./tests/fixtures/example-app');

      sinon.stub(resolver, '_resolveImportPath', function(importName, nodeModulesPath)  {
        var importPath = path.join(nodeModulesPath, importName);
        return importPath;
      });
    });

    afterEach(function() {
      process.chdir(cwd);
      resolver._resolveImportPath.restore();
    });

    it('should return a recursive list of paths to module basedirs based on edges', function() {
      var expectation = resolver.moduleDirs([{
        v: 'ember-moment/helpers/moment',
        w: 'npm:moment'
      }], {
        'ember-moment': {
          nodeModulesPath: path.join(process.cwd(), 'node_modules', 'ember-moment', 'node_modules')
        }
      });

      expect(expectation).to.deep.eql([
        path.resolve(process.cwd(), 'node_modules/ember-moment/node_modules/moment'),
        path.resolve(process.cwd(), 'node_modules/ember-moment')
      ]);
    });
  });

  describe('byPackageName', function() {
    it('it splits the anotation and returns the module name', function() {
      expect(resolver.byPackageName('npm:foo-bar')).to.eql('foo-bar');
    });
  });
});
