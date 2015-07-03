'use strict';

var resolver = require('../../lib/resolvers/es');
var sinon = require('sinon');
var fs = require('fs-extra');
var generateTreeDescriptors = require('../helpers/generate-tree-descriptors');
var temp = require('quick-temp');
var Import = require('../../lib/models/import');
var expect = require('chai').expect;
var AllDependencies = require('../../lib/all-dependencies');

describe('es resolver', function() {

  var treeMeta = [{
      name: 'example-app',
      type: 'app'
    },
    {
      name: 'tests',
      altName: 'example-app/tests',
      parent: 'example-app',
      type: 'tests'
    },
    {
      name: 'ember',
      type: 'addon'
    },
    {
      name: 'ember-load-initializers',
      type: 'addon'
    },
    {
      name: 'ember-moment',
      type: 'addon'
    },
    {
      name: 'ember-resolver',
      type: 'addon'
  }];

  beforeEach(function() {
    sinon.spy(resolver, 'syncForwardDependency');
  });

  afterEach(function() {
    AllDependencies._synced = {};
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
      treeDescriptors: generateTreeDescriptors(treeMeta)
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
      treeDescriptors: generateTreeDescriptors(treeMeta)
    });

    expect(resolver.syncForwardDependency.callCount).to.eql(4);
    expect(resolver.syncForwardDependency.firstCall.args[4]).to.eql('lodash/lib/lodash.js');
    expect(resolver.syncForwardDependency.secondCall.args[4]).to.eql('lodash/lib/array/uniq.js');
    expect(resolver.syncForwardDependency.thirdCall.args[4]).to.eql('lodash/lib/array/flatten.js');
    expect(resolver.syncForwardDependency.lastCall.args[4]).to.eql('lodash/lib/compat.js');
  });

  describe('enforce jsnext:main conventions', function() {
    var pkgPath = 'tests/fixtures/example-app/node_modules/ember/node_modules/lodash/package.json';
    var pkg = fs.readJSONSync(pkgPath);

    beforeEach(function() {
      pkg.main = pkg['jsnext:main'];
      delete pkg['jsnext:main'];
      fs.outputJSONSync(pkgPath, pkg);
    });

    afterEach(function() {
      pkg['jsnext:main'] = pkg.main;
      delete pkg.main;
      fs.outputJSONSync(pkgPath, pkg);
    });


    it('should throw if the import does not have jsnext:main conventions', function() {
      var importInfo = new Import({
        importer: 'ember',
        packageName: 'lodash',
        name: 'lodash',
        type: 'es'
      });

      var tempDir = temp.makeOrRemake({}, 'es-test');
      var treeDescriptors = generateTreeDescriptors(treeMeta);


      var willThrow = function() {
        return resolver.resolve(tempDir, importInfo, {
          treeDescriptors: treeDescriptors
        });
      };

      expect(willThrow).to.throw(/You attempted to resolve "lodash" from the "lodash" package. To accurately resolve ES6 modules, the package must provide a "jsnext:main" key in it\'s package.json./);
    });
  });
});
