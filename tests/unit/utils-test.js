'use strict';

var utils = require('../../lib/utils');
var expect = require('chai').expect;
var path = require('path');

describe('utils', function() {

  describe('getImportInfo', function() {

    it('should pass you information for a node', function() {
      var info = utils.getImportInfo('example-app/config/environment', 'example-app');
      expect(info).to.deep.equal({
        type: 'ember-app',
        name: 'example-app/config/environment',
        pkgName: 'example-app'
      });
    });

    it('should pass you information for an addon', function() {
      var info = utils.getImportInfo('ember/get', null, { ember: { inputPath: process.cwd() } } );
      expect(info).to.deep.equal({
        type: 'ember-app',
        name: 'ember/ember/get',
        pkgName: 'ember'
      });
    });

    it('should pass you information for an addon that is a file', function() {
      var info = utils.getImportInfo('ember', null, { ember: { inputPath: process.cwd() } });
      expect(info).to.deep.equal({
        type: 'ember-app',
        name: 'ember/ember',
        pkgName: 'ember'
      });
    });

    it('should pass you information for a specific type', function() {
      var info = utils.getImportInfo('npm:moment/ago');
      expect(info).to.deep.equal({
        type: 'npm',
        name: 'moment/ago',
        pkgName: 'moment'
      });
    });
  });

  describe('resolvePackage', function() {
    var cwd = process.cwd();

    beforeEach(function() {
      process.chdir('./tests/fixtures/example-app');
    });

    afterEach(function() {
      process.chdir(cwd);
    });


    it('should resolve to the root of the package', function() {
      var packagePath = utils.resolvePackage('ember-moment', '.');
      expect(packagePath).to.eql(path.join(process.cwd(), 'node_modules/ember-moment'));
    });
  });
});