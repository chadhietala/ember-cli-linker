'use strict';

var fs                = require('fs-extra');
var path              = require('path');
var symlinkOrCopySync = require('symlink-or-copy').sync;
var AllDependencies   = require('../all-dependencies');

function link(source, destination) {
  fs.mkdirsSync(path.dirname(destination));
  symlinkOrCopySync(source, destination);
}

/**
 * Syncs forward a source file to the destination. Also is responsible for adding nodes and edges into the overall dependency graph.
 *
 * @example
 *
 *syncForwardDependencies({
 *  destination: '/tmp_foo/',
 *  source: '/tmp_some_other_tmp/dummy/app.js',
 *  node: {
 *   tail: 'dummy/app',
 *   heads: ['ember', 'ember/resolver', 'dummy/config/environment']
 *  },
 *  meta: {
 *   relativePath: 'dummy/app.js',
 *   package: 'dummy'
 *  }
 *});
 *
 * @param  {Object} syncOptions A hash of options for syncing
 * @property {String} syncOptions.source A path to the source file
 * @property {String} syncOptions.destination A path to the destination where the source will be linked.
 * @property {Object} [syncOptions.node] A hash that descibes the a node
 * @property {Array} [syncOptions.node.heads] An array of the head nodes of the edge
 * @property {String} [syncOptions.node.tail] The tail node of an edge
 * @property {Object} [syncOptions.meta] Arbitary hash to attach to the tail node
 * @return {Nil}
 */
module.exports = function(syncOptions) {
  var destination = syncOptions.destination;
  var source = syncOptions.source;

  if (!fs.existsSync(destination)) {
    link(source, destination);


    if (syncOptions.node) {
      var meta = syncOptions.meta;
      var node = syncOptions.node;
      var heads = node.heads;
      var tail = node.tail;

      meta.source = source;
      meta.destination = destination;
      meta.syncedToDisk = true;
      AllDependencies.sync(tail, heads, meta);
    }
  }
};
