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

function zip(arr1, arr2) {
  return arr1.map(function(item, i) {
    return [item, arr2[i]];
  });
}

function flatMap(arr, fn, context) {
  return flatten(arr.map(fn), context);
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
  zip: zip,
  uniq: uniq,
  flatMap: flatMap,
  flatten: flatten,
  arraysEqual: arraysEqual
};