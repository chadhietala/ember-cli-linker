'use strict';

function uniq(arr) {
  return arr.reduce(function(a, b) {
    if (a.indexOf(b) < 0) {
      a.push(b);
    }
    return a;
  }, []);
}

function zip(arr1, arr2) {
  return arr1.map(function(item, i) {
    return [item, arr2[i]];
  });
}

function compact(array) {
  return array.filter(Boolean);
}

function equal(a, b) {
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

var contains = (function() {
  return Array.prototype.includes ? function(arr, value) {
    return arr.includes(value);
  } : function(arr, value) {
    return arr.some(function(item) {
      return item === value;
    });
  };
})();

function flatten(array) {
  return array.reduce(function(a, b) {
    return a.concat(b);
  });
}

function intersect(array1, array2) {
  return array1.filter(function(item) { return array2.indexOf(item) !== -1; });
}

function without(array, exclusions) {
  return array.filter(function(item) {
    return !exclusions.some(function(exclude) {
      return item === exclude;
    });
  });
}

function head(array) {
  return array[0];
}

module.exports = {
  zip: zip,
  uniq: uniq,
  equal: equal,
  compact: compact,
  contains: contains,
  flatten: flatten,
  without: without,
  intersect: intersect,
  head: head
};