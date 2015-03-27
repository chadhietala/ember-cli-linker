'use strict';

var PrePackager     = require('../../lib/pre-packager');
var helpers         = require('broccoli-test-helpers');
var stew            = require('broccoli-stew');
var path            = require('path');
var expect          = require('chai').expect;
var find            = stew.find;
var log             = stew.log;
var makeTestHelper  = helpers.makeTestHelper;
var cleanupBuilders = helpers.cleanupBuilders;

describe('pre-package acceptance', function () {
  var fixturePath = path.resolve('./tests/fixtures');
  var prePackager = makeTestHelper({
    fixturePath: fixturePath,
    subject: function() {
      return new PrePackager(arguments[0], arguments[1]);
    },
    filter: function(paths) {
      return paths.filter(function(path) { return !/\/$/.test(path); })
    }
  });

  afterEach(function () {
    return cleanupBuilders();
  });

  it('should only include files in the dependency graph', function () {
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
    });
  });
});