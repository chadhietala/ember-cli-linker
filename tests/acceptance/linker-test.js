'use strict';

var Linker     = require('../../lib/linker');
var helpers         = require('broccoli-test-helpers');
var path            = require('path');
var expect          = require('chai').expect;
var fs              = require('fs-extra');
var sinon           = require('sinon');
var generateTreeDescriptors = require('../helpers/generate-tree-descriptors');
var treeMeta        = require('../helpers/tree-meta');
var AllDependencies = require('../../lib/all-dependencies');
var Graph           = require('graphlib').Graph;
var makeTestHelper  = helpers.makeTestHelper;
var cleanupBuilders = helpers.cleanupBuilders;

function clone(a) {
   return JSON.parse(JSON.stringify(a));
}

describe('linker acceptance', function () {
  var fixturePath = path.resolve('./tests/fixtures/example-app');
  var testSubject = function() {
    return new Linker(arguments[0], arguments[1]);
  };

  var linker;
  beforeEach(function() {
    linker = makeTestHelper({
      fixturePath: fixturePath,
      subject: testSubject,
      filter: function(paths) {
        return paths.filter(function(path) { return !/\/$/.test(path); });
      }
    });
  });


  afterEach(function () {
    AllDependencies._packages = {};
    AllDependencies.graph = new Graph();
    linker = null;
    return cleanupBuilders();
  });

  it('should throw if no entries are passed', function () {
    var orderedDescs = generateTreeDescriptors(treeMeta, true);
    var trees = orderedDescs.map(function(desc) {
      return desc.tree;
    });

    return linker(trees).catch(function(err) {
      expect(err.message).to.eql('You must pass an array of entries.');
    });
  });

  it('should only include files in the dependency graph', function () {
    var orderedDescs = generateTreeDescriptors(treeMeta, true);
    var descs = generateTreeDescriptors(treeMeta);
    var trees = orderedDescs.map(function(desc) {
      return desc.tree;
    });

    return linker(trees, {
      entries: ['example-app', 'example-app/tests'],
      treeDescriptors: {
        ordered: orderedDescs,
        map: descs
      }
    }).then(function(results) {
      expect(results.files.sort()).to.deep.eql([
        'browserified-bundle.js',
        'ember-load-initializers.js',
        'ember-moment/helpers/ago.js',
        'ember-moment/helpers/duration.js',
        'ember-moment/helpers/moment.js',
        'ember-resolver.js',
        'ember.js',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/index.html',
        'example-app/initializers/ember-moment.js',
        'example-app/router.js',
        'example-app/tests/unit/components/foo-bar-test.js',
        'lodash/lib/array/flatten.js',
        'lodash/lib/array/uniq.js',
        'lodash/lib/compat.js',
      ]);
    });
  });

  it('should remove files from the output if the imports are removed', function () {
    var graphPath = path.join(process.cwd(), 'tests/fixtures/example-app/tree/example-app/dep-graph.json');
    var graph = fs.readJSONSync(graphPath);
    var graphClone = clone(graph);
    var orderedDescs = generateTreeDescriptors(treeMeta, true);
    var descs = generateTreeDescriptors(treeMeta);
    var trees = orderedDescs.map(function(desc) {
      return desc.tree;
    });
    var initializer = path.join(process.cwd(), '/tests/fixtures/example-app/tree/example-app/initializers/ember-moment.js');

    return linker(trees, {
      entries: ['example-app', 'example-app/tests'],
      treeDescriptors: {
        ordered: orderedDescs,
        map: descs
      },
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
        'browserified-bundle.js',
        'ember-load-initializers.js',
        'ember-resolver.js',
        'ember.js',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/index.html',
        'example-app/router.js',
        'example-app/tests/unit/components/foo-bar-test.js',
        'lodash/lib/array/flatten.js',
        'lodash/lib/array/uniq.js',
        'lodash/lib/compat.js'
      ]);

    });
  });

  it('should transpile regular es6 modules', function() {
    var orderedDescs = generateTreeDescriptors(treeMeta, true);
    var descs = generateTreeDescriptors(treeMeta);
    var trees = orderedDescs.map(function(desc) {
      return desc.tree;
    });

    return linker(trees, {
      entries: ['example-app', 'example-app/tests'],
      treeDescriptors: {
        ordered: orderedDescs,
        map: descs
      }
    }).then(function(results) {
      var babelified = fs.readFileSync(results.directory + '/lodash/lib/array/uniq.js', 'utf8');
      expect(babelified.indexOf('=>')).to.be.lt(0);
      expect(babelified.indexOf('...args')).to.be.lt(0);
    });
  });

  // TODO
  // Spying on functions with broccoli-test-helpers is no bueno
  describe('node_modules rebuild', function() {
    beforeEach(function() {
      linker = makeTestHelper({
        fixturePath: fixturePath,
        subject: testSubject,
        prepSubject: function(subject) {
          subject.resolvers.npm.cache = {};
          sinon.spy(subject.resolvers.npm, 'compile');
          return subject;
        }
      });
    });

    afterEach(function () {
      return cleanupBuilders();
    });

    it('should not re-browserfify if the package has not changed', function() {
      var orderedDescs = generateTreeDescriptors(treeMeta, true);
      var descs = generateTreeDescriptors(treeMeta);
      var trees = orderedDescs.map(function(desc) {
        return desc.tree;
      });

      return linker(trees, {
        entries: ['example-app', 'example-app/tests'],
        treeDescriptors: {
          ordered: orderedDescs,
          map: descs
        }
      }).then(function(results) {
        return results.builder();
      }).then(function(results) {
        return results.builder();
      }).then(function(results) {
        // Should run for ember and ember-moment
        expect(results.subject.resolvers.npm.compile.callCount).to.equal(3);
        results.subject.resolvers.npm.compile.restore();
      });
    });

    it('should re-browserfify if the package changed', function() {
      var orderedDescs = generateTreeDescriptors(treeMeta, true);
      var descs = generateTreeDescriptors(treeMeta);
      var trees = orderedDescs.map(function(desc) {
        return desc.tree;
      });
      var index = './tests/fixtures/example-app/node_modules/ember-moment/node_modules/moment/index.js';
      var momentIndexContent = fs.readFileSync(index, 'utf8');
      var moment = './tests/fixtures/example-app/node_modules/ember-moment/node_modules/moment/lib/month.js';
      return linker(trees, {
        entries: ['example-app', 'example-app/tests'],
        treeDescriptors: {
          ordered: orderedDescs,
          map: descs
        }
      }).then(function(results) {
        fs.writeFileSync(moment, 'var a = "a";');
        fs.writeFileSync(index, momentIndexContent + '\n var month = require("./lib/month")');
        return results.builder();
      }).then(function(results) {
        fs.remove(moment);
        fs.writeFileSync(index, momentIndexContent);
        var contents = fs.readFileSync(path.join(results.directory, 'browserified-bundle.js'), 'utf8');
        expect( contents.indexOf('var a = "a";') > -1).to.be.ok;
        expect(results.subject.resolvers.npm.compile.callCount).to.equal(2);
        results.subject.resolvers.npm.compile.restore();
      });
    });
  });
});
