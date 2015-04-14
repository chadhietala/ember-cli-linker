'use strict';

function uniq(arr) {
  return arr.reduce(function(a, b) {
    if (a.indexOf(b) < 0) {
      a.push(b);
    }
    return a;
  }, []);
}

function flatten(arr) {
  return arr.reduce(function(a, b) {
    return a.concat(b);
  });
}

function flatMap(arr, fn) {
  return flatten(arr.map(fn));
}

function isEntryFiles(entry) {
  return function(relativePath) {
    return relativePath.indexOf(entry) > -1 && relativePath.slice(-1) !== '/' && relativePath.indexOf('dep-graph.json') < 0;
  };
}

function importType(imprt) {
  var importParts = imprt.split(':');
  var type = {};

  if (importParts.length > 1) {
    type.type = importParts[0];
    type.id = importParts[1];
    type.pkg = importParts[1].split('/')[0];
  } else {
    type.type = 'default';
    type.id = imprt;
    type.pkg = imprt.split('/')[0];
  }

  return type;
}

function arraysEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]){
      return false;
    }
  }

  return true;
}

module.exports = {
  uniq: uniq,
  flatMap: flatMap,
  flatten: flatten,
  isEntryFiles: isEntryFiles,
  importType: importType,
  arraysEqual: arraysEqual
};