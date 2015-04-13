'use strict';

var PrePackager     = require('../../lib/pre-packager');
var helpers         = require('broccoli-test-helpers');
var stew            = require('broccoli-stew');
var path            = require('path');
var expect          = require('chai').expect;
var fs              = require('fs-extra');
var find            = stew.find;
var makeTestHelper  = helpers.makeTestHelper;
var cleanupBuilders = helpers.cleanupBuilders;

function clone(a) {
   return JSON.parse(JSON.stringify(a));
}

describe('pre-package acceptance', function () {
  var fixturePath = path.resolve('./tests/fixtures');
  var prePackager = makeTestHelper({
    fixturePath: fixturePath,
    subject: function() {
      return new PrePackager(arguments[0], arguments[1]);
    },
    filter: function(paths) {
      return paths.filter(function(path) { return !/\/$/.test(path); });
    }
  });

  afterEach(function () {
    return cleanupBuilders();
  });

  it('should throw if no entries are passed', function () {
    return prePackager(find('.')).catch(function(err) {
      expect(err).to.deep.equal(new Error('You must pass an array of entries.'));
    });
  });

  it('should only include files in the dependency graph', function () {
    return prePackager(find('.'), {
      entries: ['example-app']
    }).then(function(results) {
      expect(results.files).to.deep.equal([
        'browserified/moment/moment.js',
        'ember/ember.js',
        'ember-load-initializers/ember-load-initializers.js',
        'ember-moment/helpers/ago.js',
        'ember-moment/helpers/duration.js',
        'ember-moment/helpers/moment.js',
        'ember-resolver/ember-resolver.js',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/initializers/ember-moment.js',
        'example-app/router.js'
      ]);
    });
  });

  it('should remove files from the output if the imports are removed', function () {
    var graphPath = path.join(process.cwd(), 'tests/fixtures/example-app/dep-graph.json');
    var graph = fs.readJSONSync(graphPath);
    var graphClone = clone(graph);

    var initializer = path.join(process.cwd(), '/tests/fixtures/example-app/initializers/ember-moment.js');

    return prePackager(find('.'), {
      entries: ['example-app']
    }).then(function(results) {
      expect(results.files).to.deep.equal([
        'browserified/moment/moment.js',
        'ember/ember.js',
        'ember-load-initializers/ember-load-initializers.js',
        'ember-moment/helpers/ago.js',
        'ember-moment/helpers/duration.js',
        'ember-moment/helpers/moment.js',
        'ember-resolver/ember-resolver.js',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/initializers/ember-moment.js',
        'example-app/router.js'
      ]);

      delete graphClone['example-app/initializers/ember-moment.js'];

      fs.outputJSONSync(graphPath, graphClone);
      fs.removeSync(initializer);

      return results.builder();
    }).then(function(results) {

      // TODO find a better way of restoring this
      fs.outputJSONSync(graphPath, graph);
      fs.writeFileSync(initializer, '');
      
      expect(results.files).to.deep.equal([
        'ember/ember.js',
        'ember-load-initializers/ember-load-initializers.js',
        'ember-resolver/ember-resolver.js',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/router.js'
      ]);

    });
  });

  it('should have edits to a file', function () {
    var initializer = path.join(process.cwd(), '/example-app/initializers/ember-moment.js');


    return prePackager(find('.'), {
      entries: ['example-app']
    }).then(function(results) {
      expect(results.files).to.deep.equal([
        'ember-moment/helpers/ago.js',
        'ember-moment/helpers/duration.js',
        'ember-moment/helpers/moment.js',
        'example-app/app.js',
        'example-app/config/environment.js',
        'example-app/initializers/ember-moment.js',
        'example-app/router.js'
      ]);

      // Simulate edit
      fs.writeFileSync(initializer, 'var a = "a";');

      return results.builder();
    }).then(function(results) {

      var changedFile = fs.readFileSync(path.join(results.directory, 'example-app/initializers/ember-moment.js'), 'utf8');

      expect(changedFile).to.equal('var a = "a";');
      fs.writeFileSync(initializer, '');
    });
  });
});