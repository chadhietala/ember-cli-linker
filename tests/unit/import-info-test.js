'use strict';
var importInfo = require('../../lib/utils/import-info');
var getImportInfo = importInfo.getImportInfo;
var getPackageName = importInfo.getPackageName;
var expect = require('chai').expect;
var Import = require('../../lib/models/import');

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
      'dummy/app.js'
    ],
    parent: null
  }
};

describe('getImportInfo', function() {
  it('should return an Import', function() {
    expect(getImportInfo(descriptors, 'dummy', 'dummy/app', 'dummy') instanceof Import).to.eql(true);
  });

  it('should conform to the Import interface', function() {
    var importInfo = getImportInfo(descriptors, 'dummy', 'dummy/app', 'dummy');
    var props = Object.keys(importInfo);
    expect(props.length).to.eql(4);
    expect(props).to.deep.eql([
      'importer',
      'packageName',
      'name',
      'type'
    ]);
  });

  it('should return the ember-app type if there is matching descriptor', function () {
    expect(getImportInfo(descriptors, 'dummy', 'dummy/app', 'dummy').type).to.eql('ember-app');
  });

  it('should return the custom type if the importee hints', function () {
    expect(getImportInfo(descriptors, 'qunit', 'npm:qunit', 'dummy').type).to.eql('npm');
  });

  it('should return the es type if the importee does not hint and is a dependency of the importer', function () {
    expect(getImportInfo(descriptors, 'lodash', 'lodash', 'dummy').type).to.eql('es');
  });

  it('should throw if the module cannot be resolved', function () {
    var willThrow = function() {
      return getImportInfo(descriptors, 'hype-bars', 'hype-bars', 'dummy');
    };

    expect(willThrow).to.throw('Cannot generate import information for hype-bars. Please make sure hype-bars is a dependency of dummy.');
  });
});

describe('getPackageName', function() {
  it('should return a scoped package name', function() {
    expect(getPackageName('@linkedin/foo/bar')).to.eql('@linkedin/foo');
  });

  it('should the package name', function() {
    expect(getPackageName('foo/bar')).to.eql('foo');
  });

  it('tests should fall back to their importer', function() {
    expect(getPackageName('foo/tests/bar-test', 'foo/tests')).to.eql('foo/tests');
  });
});
