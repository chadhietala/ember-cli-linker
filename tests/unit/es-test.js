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
    sinon.spy(resolver, 'syncForwardDependency');
  });

  afterEach(function() {
    resolver.syncForwardDependency.restore();
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

    expect(resolver.syncForwardDependency.callCount).to.eql(3);
    expect(resolver.syncForwardDependency.firstCall.args[4]).to.eql('lodash/lib/array/uniq.js');
    expect(resolver.syncForwardDependency.secondCall.args[4]).to.eql('lodash/lib/array/flatten.js');
    expect(resolver.syncForwardDependency.thirdCall.args[4]).to.eql('lodash/lib/compat.js');
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
    expect(resolver.syncForwardDependency.callCount).to.eql(4);
    expect(resolver.syncForwardDependency.firstCall.args[4]).to.eql('lodash/lib/lodash.js');
    expect(resolver.syncForwardDependency.secondCall.args[4]).to.eql('lodash/lib/array/uniq.js');
    expect(resolver.syncForwardDependency.thirdCall.args[4]).to.eql('lodash/lib/array/flatten.js');
    expect(resolver.syncForwardDependency.lastCall.args[4]).to.eql('lodash/lib/compat.js');
  });

});