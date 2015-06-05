'use strict';

var resolver = require('../../lib/resolvers/es');
var sinon = require('sinon');
var generateTreeDescriptors = require('../helpers/generate-tree-descriptors');
var walkSync = require('walk-sync');
var temp = require('quick-temp');
var Import = require('../../lib/models/import');
var expect = require('chai').expect;

describe('es resolver', function() {
  var paths = walkSync('tests/fixtures/example-app/tree');

  beforeEach(function() {
    sinon.spy(resolver, 'syncForwardDependencies');
  });

  afterEach(function() {
    resolver.syncForwardDependencies.restore();
  });

  it('should sync forward non-main file it\'s imports', function() {
    var importInfo = new Import({
      importer: 'ember',
      packageName: 'lodash',
      name: 'lodash/lib/array/uniq',
      type: 'es'
    });

    var tempDir = temp.makeOrRemake({}, 'es-test');

    resolver.resolve(tempDir, importInfo, {
      treeDescriptors: generateTreeDescriptors(paths)
    });
    expect(resolver.syncForwardDependencies.callCount).to.eql(3);
    expect(resolver.syncForwardDependencies.firstCall.args[0]).to.eql(tempDir + '/' + 'lodash/lib/array/uniq.js');
    expect(resolver.syncForwardDependencies.secondCall.args[0]).to.eql(tempDir + '/' + 'lodash/lib/array/flatten.js');
    expect(resolver.syncForwardDependencies.thirdCall.args[0]).to.eql(tempDir + '/' + 'lodash/lib/compat.js');
  });

  it('should sync forward main file it\'s imports', function() {
    var importInfo = new Import({
      importer: 'ember',
      packageName: 'lodash',
      name: 'lodash',
      type: 'es'
    });

    var tempDir = temp.makeOrRemake({}, 'es-test');

    resolver.resolve(tempDir, importInfo, {
      treeDescriptors: generateTreeDescriptors(paths)
    });
    expect(resolver.syncForwardDependencies.callCount).to.eql(4);
    expect(resolver.syncForwardDependencies.firstCall.args[0]).to.eql(tempDir + '/' + 'lodash/lib/lodash.js');
    expect(resolver.syncForwardDependencies.secondCall.args[0]).to.eql(tempDir + '/' + 'lodash/lib/array/uniq.js');
    expect(resolver.syncForwardDependencies.thirdCall.args[0]).to.eql(tempDir + '/' + 'lodash/lib/array/flatten.js');
    expect(resolver.syncForwardDependencies.lastCall.args[0]).to.eql(tempDir + '/' + 'lodash/lib/compat.js');
  });

});