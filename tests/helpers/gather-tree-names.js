'use strict';
var compact = require('../../lib/utils/array').compact;

function gatherTreeNames(paths) {
  return paths.filter(function(relativePath) {
    return relativePath.slice(-1) === '/';
  }).filter(function(relativePath) {
    return compact(relativePath.split('/')).length === 1;
  }).map(function(relativePath) {
    return relativePath.replace('/', '');
  });
}

module.exports = gatherTreeNames;