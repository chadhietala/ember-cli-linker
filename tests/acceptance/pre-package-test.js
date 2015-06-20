'use strict';

var PrePackager     = require('../../lib/pre-packager');
var helpers         = require('broccoli-test-helpers');
var stew            = require('broccoli-stew');
var path            = require('path');
var expect          = require('chai').expect;
var fs              = require('fs-extra');
var sinon           = require('sinon');
var walkSync        = require('walk-sync');
var generateTreeDescriptors = require('../helpers/generate-tree-descriptors');
var generateTrees = require('../helpers/generate-trees');
var find            = stew.find;
var makeTestHelper  = helpers.makeTestHelper;
var cleanupBuilders = helpers.cleanupBuilders;

function clone(a) {
   return JSON.parse(JSON.stringify(a));
}

describe('pre-package acceptance', function () {
  var fixturePath = path.resolve('./tests/fixtures/example-app');
  var testSubject = function() {
      return new PrePackager(arguments[0], arguments[1]);
  };
  var prePackager = makeTestHelper({
    fixturePath: fixturePath,
    subject: testSubject,
    filter: function(paths) {
      return paths.filter(function(path) { return !/\/$/.test(path); });
    }
  });
  var paths = walkSync('tests/fixtures/example-app/tree');

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


  afterEach(function () {
    return cleanupBuilders();
  });

  it('should throw if no entries are passed', function () {
    return prePackager(find('tree')).catch(function(err) {
      expect(err.message).to.eql('You must pass an array of entries.');
    });
  });

  it('should only include files in the dependency graph', function () {
    return prePackager(generateTrees(treeMeta), {
      entries: ['example-app', 'example-app/tests'],
      treeDescriptors: generateTreeDescriptors(treeMeta)
    }).then(function(results) {
      expect(results.files.sort()).to.deep.eql([
        'browserified/ember-moment/ember-moment-legacy.js',
        'browserified/ember/ember-legacy.js',
        'ember-load-initializers.js',
        'ember-load-initializers/dep-graph.json',
        'ember-moment/dep-graph.json',
        'ember-moment/helpers/ago.js',
        'ember-moment/helpers/duration.js',
        'ember-moment/helpers/moment.js',
        'ember-resolver.js',
        'ember-resolver/dep-graph.json',
        'ember.js',
        'ember/dep-graph.json',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/dep-graph.json',
        'example-app/index.html',
        'example-app/initializers/ember-moment.js',
        'example-app/router.js',
        'example-app/tests/dep-graph.json',
        'example-app/tests/unit/components/foo-bar-test.js',
        'lodash/lib/array/flatten.js',
        'lodash/lib/array/flatten.map',
        'lodash/lib/array/uniq.js',
        'lodash/lib/array/uniq.map',
        'lodash/lib/compat.js',
        'lodash/lib/compat.map'
      ]);
    });
  });

  it.skip('should remove files from the output if the imports are removed', function () {
    var graphPath = path.join(process.cwd(), 'tests/fixtures/example-app/tree/example-app/dep-graph.json');
    var graph = fs.readJSONSync(graphPath);
    var graphClone = clone(graph);

    var initializer = path.join(process.cwd(), '/tests/fixtures/example-app/tree/example-app/initializers/ember-moment.js');

    return prePackager(generateTrees(paths), {
      entries: ['example-app'],
      treeDescriptors: generateTreeDescriptors(paths)
    }).then(function(results) {

      delete graphClone['example-app/initializers/ember-moment.js'];

      fs.outputJSONSync(graphPath, graphClone);
      fs.removeSync(initializer);

      return results.builder();
    }).then(function(results) {
      // TODO find a better way of restoring this
      fs.outputJSONSync(graphPath, graph);
      fs.writeFileSync(initializer, '');
      expect(results.files.sort()).to.deep.equal([
        'browserified/ember/ember-legacy.js',
        'ember-load-initializers.js',
        'ember-load-initializers/dep-graph.json',
        'ember-resolver.js',
        'ember-resolver/dep-graph.json',
        'ember.js',
        'ember/dep-graph.json',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/dep-graph.json',
        'example-app/index.html',
        'example-app/router.js',
        'example-app/tests/dep-graph.json',
        'example-app/tests/unit/components/foo-bar-test.js',
        'lodash/lib/array/flatten.js',
        'lodash/lib/array/uniq.js',
        'lodash/lib/compat.js'
      ]);

    });
  });

  it.skip('should transpile regular es6 modules', function() {
    return prePackager(generateTrees(treeMeta), {
      entries: ['example-app', 'example-app/tests'],
      treeDescriptors: generateTreeDescriptors(paths)
    }).then(function(results) {
      var babelified = fs.readFileSync(results.directory + '/lodash/lib/array/uniq.js', 'utf8');
      expect(babelified.indexOf('=>')).to.be.lt(0);
      expect(babelified.indexOf('...args')).to.be.lt(0);
    });
  });
  
  // TODO
  // Spying on functions with broccoli-test-helpers is no bueno
  describe.skip('node_modules rebuild', function() {
    beforeEach(function() {
      prePackager = makeTestHelper({
        fixturePath: fixturePath,
        subject: testSubject,
        prepSubject: function(subject) {
          subject.resolvers.npm.cache = {};
          sinon.spy(subject.resolvers.npm, 'updateCache');
          return subject;
        }
      });
    });

    afterEach(function () {
      return cleanupBuilders();
    });

    it('should not re-browserfify if the package has not changed', function() {
      return prePackager(generateTrees(paths), {
        entries: ['example-app'],
        treeDescriptors: generateTreeDescriptors(paths)
      }).then(function(results) {
        return results.builder();
      }).then(function(results) {
        return results.builder();
      }).then(function(results) {
        // Should run for ember and ember-moment
        expect(results.subject.resolvers.npm.updateCache.callCount).to.equal(2);
        results.subject.resolvers.npm.updateCache.restore();
      });
    });

    it('should re-browserfify if the package changed', function() {
      var moment = './tests/fixtures/example-app/node_modules/ember-moment/node_modules/moment/lib/month.js';
      return prePackager(generateTrees(paths), {
        entries: ['example-app'],
        treeDescriptors: generateTreeDescriptors(paths)
      }).then(function(results) {
        fs.writeFileSync(moment, 'var a = "a";');
        return results.builder();
      }).then(function(results) {
        fs.remove(moment);
        expect(results.subject.resolvers.npm.updateCache.callCount).to.equal(3);
        results.subject.resolvers.npm.updateCache.restore();
      });
    });
  });
});
