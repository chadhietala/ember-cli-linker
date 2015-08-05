'use strict';

var Linker          = require('../../lib/linker');
var helpers         = require('broccoli-test-helpers');
var path            = require('path');
var expect          = require('chai').expect;
var fs              = require('fs-extra');
var sinon           = require('sinon');
var genTreeDesc     = require('../helpers/generate-tree-descriptors');
var treeMeta        = require('../helpers/tree-meta');
var AllDependencies = require('../../lib/all-dependencies');
var Graph           = require('graphlib').Graph;
var makeTestHelper  = helpers.makeTestHelper;
var cleanupBuilders = helpers.cleanupBuilders;
var stringify       = require('json-stable-stringify');

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
    var orderedDescs = genTreeDesc(treeMeta, true);
    var trees = orderedDescs.map(function(desc) {
      return desc.tree;
    });

    return linker(trees).catch(function(err) {
      expect(err.message).to.eql('You must pass an array of entries.');
    });
  });

  it('should only include files in the dependency graph', function () {
    var orderedDescs = genTreeDesc(treeMeta, true);
    var descs = genTreeDesc(treeMeta);
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
        'dep-graph.dot',
        'engines/example-app/example-app/app.js',
        'engines/example-app/example-app/config/environment.js',
        'engines/example-app/example-app/initializers/ember-moment.js',
        'engines/example-app/example-app/router.js',
        'engines/example-app/tests/example-app/tests/unit/components/foo-bar-test.js',
        'engines/shared/browserified-bundle.js',
        'engines/shared/ember-load-initializers.js',
        'engines/shared/ember-moment/helpers/ago.js',
        'engines/shared/ember-moment/helpers/duration.js',
        'engines/shared/ember-moment/helpers/moment.js',
        'engines/shared/ember-resolver.js',
        'engines/shared/ember.js',
        'engines/shared/lodash/lib/array/flatten.js',
        'engines/shared/lodash/lib/array/uniq.js',
        'engines/shared/lodash/lib/compat.js'
      ]);

      var browserified = results.directory + path.sep + 'engines/shared/browserified-bundle.js';
      var assertion = fs.readFileSync('./tests/assertions/browserified-bundle.js');

      expect(fs.readFileSync(browserified)).to.eql(assertion);
    });
  });

  it('should remove files from the output if the imports are removed', function () {
    var graphPath = path.join(process.cwd(), 'tests/fixtures/example-app/tree/example-app/dep-graph.json');
    var graph = fs.readJSONSync(graphPath);
    var graphClone = clone(graph);
    var orderedDescs = genTreeDesc(treeMeta, true);
    var descs = genTreeDesc(treeMeta);
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
        'dep-graph.dot',
        'engines/example-app/example-app/app.js',
        'engines/example-app/example-app/config/environment.js',
        'engines/example-app/example-app/router.js',
        'engines/example-app/tests/example-app/tests/unit/components/foo-bar-test.js',
        'engines/shared/browserified-bundle.js',
        'engines/shared/ember-load-initializers.js',
        'engines/shared/ember-resolver.js',
        'engines/shared/ember.js',
        'engines/shared/lodash/lib/array/flatten.js',
        'engines/shared/lodash/lib/array/uniq.js',
        'engines/shared/lodash/lib/compat.js'
      ]);

    });
  });

  it('should include files that were imported via app.import', function() {
    var orderedDescs = genTreeDesc(treeMeta, true);
    var descs = genTreeDesc(treeMeta);
    var trees = orderedDescs.map(function(desc) {
      return desc.tree;
    });
    var graphPath = 'tests/fixtures/example-app/tree/example-app/dep-graph.json';
    var originalGraph = fs.readJSONSync(graphPath);
    var graph = clone(originalGraph);

    graph['example-app/app.js'].imports.push({
      'imported': [
        'default'
      ],
      'source': 'fizz',
      'specifiers': [
        {
          'imported': 'default',
          'kind': 'named',
          'local': 'Fizz'
        }
      ]
    });

    fs.writeFileSync(graphPath, stringify(graph));

    return linker(trees, {
      entries: ['example-app', 'example-app/tests'],
      legacyFilesToAppend: [
        {
          exports: { fizz: ['default'] },
          type: 'vendor',
          prepend: false,
          path: 'bower_components/foo-bar/baz.js',
          files: [ 'fizz' ]
        }
      ],
      treeDescriptors: {
        ordered: orderedDescs,
        map: descs
      }
    }).then(function(results) {
      fs.writeFileSync(graphPath, stringify(originalGraph));
      expect(results.files).to.deep.eql([
        'dep-graph.dot',
        'engines/example-app/example-app/app.js',
        'engines/example-app/example-app/config/environment.js',
        'engines/example-app/example-app/initializers/ember-moment.js',
        'engines/example-app/example-app/router.js',
        'engines/example-app/tests/example-app/tests/unit/components/foo-bar-test.js',
        'engines/shared/baz.js',
        'engines/shared/browserified-bundle.js',
        'engines/shared/ember-load-initializers.js',
        'engines/shared/ember-moment/helpers/ago.js',
        'engines/shared/ember-moment/helpers/duration.js',
        'engines/shared/ember-moment/helpers/moment.js',
        'engines/shared/ember-resolver.js',
        'engines/shared/ember.js',
        'engines/shared/lodash/lib/array/flatten.js',
        'engines/shared/lodash/lib/array/uniq.js',
        'engines/shared/lodash/lib/compat.js'
      ]);
    });
  });

  it('if the same legacy file exports multiple items files the backing file only is added once', function() {
    var orderedDescs = genTreeDesc(treeMeta, true);
    var descs = genTreeDesc(treeMeta);
    var trees = orderedDescs.map(function(desc) {
      return desc.tree;
    });
    var graphPath = 'tests/fixtures/example-app/tree/example-app/dep-graph.json';
    var originalGraph = fs.readJSONSync(graphPath);
    var graph = clone(originalGraph);

    graph['example-app/app.js'].imports.push({
      'imported': [
        'default'
      ],
      'source': 'fizz',
      'specifiers': [
        {
          'imported': 'default',
          'kind': 'named',
          'local': 'Fizz'
        }
      ]
    },
    {
      'imported': [
        'default'
      ],
      'source': 'bazz',
      'specifiers': [
        {
          'imported': 'default',
          'kind': 'named',
          'local': 'Bazz'
        }
      ]
    });

    fs.writeFileSync(graphPath, stringify(graph));

    return linker(trees, {
      entries: ['example-app', 'example-app/tests'],
      legacyFilesToAppend: [
        {
          exports: { fizz: ['default'], bazz: ['default'] },
          type: 'vendor',
          prepend: false,
          path: 'bower_components/foo-bar/baz.js',
          files: [ 'fizz', 'bazz' ]
        }
      ],
      treeDescriptors: {
        ordered: orderedDescs,
        map: descs
      }
    }).then(function(results) {
      fs.writeFileSync(graphPath, stringify(originalGraph));
      expect(results.files).to.deep.eql([
        'dep-graph.dot',
        'engines/example-app/example-app/app.js',
        'engines/example-app/example-app/config/environment.js',
        'engines/example-app/example-app/initializers/ember-moment.js',
        'engines/example-app/example-app/router.js',
        'engines/example-app/tests/example-app/tests/unit/components/foo-bar-test.js',
        'engines/shared/baz.js',
        'engines/shared/browserified-bundle.js',
        'engines/shared/ember-load-initializers.js',
        'engines/shared/ember-moment/helpers/ago.js',
        'engines/shared/ember-moment/helpers/duration.js',
        'engines/shared/ember-moment/helpers/moment.js',
        'engines/shared/ember-resolver.js',
        'engines/shared/ember.js',
        'engines/shared/lodash/lib/array/flatten.js',
        'engines/shared/lodash/lib/array/uniq.js',
        'engines/shared/lodash/lib/compat.js'
      ]);
    });
  });

  it('should transpile regular es6 modules', function() {
    var orderedDescs = genTreeDesc(treeMeta, true);
    var descs = genTreeDesc(treeMeta);
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
      var babelified = fs.readFileSync(results.directory + '/engines/shared/lodash/lib/array/uniq.js', 'utf8');
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
      var orderedDescs = genTreeDesc(treeMeta, true);
      var descs = genTreeDesc(treeMeta);
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
      var orderedDescs = genTreeDesc(treeMeta, true);
      var descs = genTreeDesc(treeMeta);
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
        var contents = fs.readFileSync(path.join(results.directory, '/engines/shared/browserified-bundle.js'), 'utf8');
        expect( contents.indexOf('var a = "a";') > -1).to.be.ok;
        expect(results.subject.resolvers.npm.compile.callCount).to.equal(2);
        results.subject.resolvers.npm.compile.restore();
      });
    });
  });
});
