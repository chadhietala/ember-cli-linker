'use strict';

var PrePackager     = require('../../lib/pre-packager');
var helpers         = require('broccoli-test-helpers');
var stew            = require('broccoli-stew');
var path            = require('path');
var expect          = require('chai').expect;
var fs              = require('fs-extra');
var sinon           = require('sinon');
var walkSync        = require('walk-sync');
var find            = stew.find;
var rename          = stew.rename;
var makeTestHelper  = helpers.makeTestHelper;
var cleanupBuilders = helpers.cleanupBuilders;

function clone(a) {
   return JSON.parse(JSON.stringify(a));
}

function generateTrees() {
  return walkSync('tests/fixtures/example-app/tree').filter(function(relativePath) {
    return relativePath.slice(-1) === '/' && (relativePath.split('/').filter(function(item) {
      return item !== '';
    })).length === 1;
  }).map(function(dir) {
    return rename(find('tree/' + dir), function(relativePath) {
      return relativePath.replace('tree/', '');
    });
  });
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

  afterEach(function () {
    return cleanupBuilders();
  });

  it('should throw if no entries are passed', function () {
    return prePackager(find('tree')).catch(function(err) {
      expect(err).to.deep.equal(new Error('You must pass an array of entries.'));
    });
  });

  it('should only include files in the dependency graph', function () {
    return prePackager(generateTrees(), {
      entries: ['example-app']
    }).then(function(results) {
      expect(results.files.sort()).to.deep.equal([
        'browserified/ember-moment/ember-moment-legacy.js',
        'browserified/ember/ember-legacy.js',
        'ember-load-initializers/dep-graph.json',
        'ember-load-initializers/ember-load-initializers.js',
        'ember-moment/dep-graph.json',
        'ember-moment/ember-moment/helpers/ago.js',
        'ember-moment/ember-moment/helpers/duration.js',
        'ember-moment/ember-moment/helpers/moment.js',
        'ember-resolver/dep-graph.json',
        'ember-resolver/ember-resolver.js',
        'ember/dep-graph.json',
        'ember/ember.js',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/dep-graph.json',
        'example-app/index.html',
        'example-app/initializers/ember-moment.js',
        'example-app/router.js'
      ]);
    });
  });

  it('should remove files from the output if the imports are removed', function () {
    var graphPath = path.join(process.cwd(), 'tests/fixtures/example-app/tree/example-app/dep-graph.json');
    var graph = fs.readJSONSync(graphPath);
    var graphClone = clone(graph);

    var initializer = path.join(process.cwd(), '/tests/fixtures/example-app/tree/example-app/initializers/ember-moment.js');

    return prePackager(generateTrees(), {
      entries: ['example-app']
    }).then(function(results) {

      delete graphClone['example-app/initializers/ember-moment.js'];

      fs.outputJSONSync(graphPath, graphClone);
      fs.removeSync(initializer);

      return results.builder();
    }).then(function(results) {
      // TODO find a better way of restoring this
      fs.outputJSONSync(graphPath, graph);
      fs.writeFileSync(initializer, '');
      
      expect(results.files).to.deep.equal([
        'ember/dep-graph.json',
        'ember/ember.js',
        'ember-load-initializers/dep-graph.json',
        'ember-load-initializers/ember-load-initializers.js',
        'ember-resolver/dep-graph.json',
        'ember-resolver/ember-resolver.js',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/dep-graph.json',
        'example-app/index.html',
        'example-app/router.js'
      ]);

    });
  });

  it('should depupe out dependency of dependency', function() {

  });
  
  // TODO
  // Spying on functions with broccoli-test-helpers is no bueno
  describe('node_modules rebuild', function() {
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
      return prePackager(generateTrees(), {
        entries: ['example-app']
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
      return prePackager(generateTrees(), {
        entries: ['example-app']
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
