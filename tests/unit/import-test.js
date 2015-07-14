'use strict';

var Import = require('../../lib/models/import');
var expect = require('chai').expect;

describe('Import', function() {

  describe('getNormalizedFileName', function() {
    it('should return a main file for a jsnext import', function() {
      var normalized = Import.getNormalizedFileName({name: 'foo', 'jsnext:main': 'lib/biz/foo'}, 'foo');
      expect(normalized).to.eql('foo/lib/biz/foo');
    });

    it('should return a main file for an import', function() {
      var normalized = Import.getNormalizedFileName({name: 'foo', 'main': 'lib/biz/foo'}, 'foo');
      expect(normalized).to.eql('foo/lib/biz/foo');
    });

    it('should be a noop if it is not a main file', function() {
      var normalized = Import.getNormalizedFileName({name: 'foo', 'main': 'lib/biz/foo'}, 'foo/lib/baz');
      expect(normalized).to.eql('foo/lib/baz');
    });
  });

  describe('getInfo', function() {
    var descriptors = {
      'dummy': {
        name: 'dummy',
        root: '/workspace/dummy',
        nodeModulesPath: '/workspace/dummy/node_modules',
        pkg: {
          name: 'dummy',
          version: '0.0.1',
          dependencies: {
            lodash: '1.0.0'
          }
        },
        relativePaths: [
          'dummy/',
          'dummy/app.js',
          'dummy/main.js'
        ],
        parent: null
      }
    };

    it('should return an Import', function() {
      expect(Import.getInfo(descriptors, {
        importName: 'dummy/app',
        packageName: 'dummy',
        importerPackageName: 'dummy',
        importer: 'dummy/main'
      }) instanceof Import).to.eql(true);
    });

    it('should conform to the Import interface', function() {
      var importInfo = Import.getInfo(descriptors, {
        importName: 'dummy/app',
        packageName: 'dummy',
        importerPackageName: 'dummy',
        importer: 'dummy/main'
      });
      var props = Object.keys(importInfo);
      expect(props.length).to.eql(5);
      expect(props).to.deep.eql([
        'importer',
        'importerPackageName',
        'packageName',
        'importName',
        'type'
      ]);
    });

    it('should return the ember-app type if there is matching descriptor', function () {
      expect(Import.getInfo(descriptors, {
        importName: 'dummy/app',
        packageName: 'dummy',
        importerPackageName: 'dummy',
        importer: 'dummy/main'
      }).type).to.eql('ember-app');
    });

    it('should return the custom type if the importee hints', function () {
      expect(Import.getInfo(descriptors,{
        importName: 'npm:jquery',
        packageName: 'jquery',
        importerPackageName: 'dummy',
        importer: 'dummy/main'
      }).type).to.eql('npm');
    });

    it('should return the es type if the importee does not hint and is a dependency of the importer', function () {
      expect(Import.getInfo(descriptors, {
        importName: 'lodash',
        packageName: 'lodash',
        importerPackageName: 'dummy',
        importer: 'dummy/main'
      }).type).to.eql('es');
    });

    it('should throw if the module cannot be resolved', function () {
      var willThrow = function() {
        return Import.getInfo(descriptors, {
          importName: 'hype-bars',
          packageName: 'hype-bars',
          importer: 'dummy/main',
          importerPackageName: 'dummy'
        });
      };

      expect(willThrow).to.throw('Cannot generate import information for hype-bars. Please make sure hype-bars is a dependency of dummy.');
    });
  });
});
