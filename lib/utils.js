'use strict';

var resolve = require('resolve').sync;
var AllDependencies = require('./all-dependencies');

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

function isEntryFiles() {
  return function(relativePath) {
    return relativePath.slice(-1) !== '/';
  };
}

function getImportInfo(imprt, entry, cache) {
  var resolverParts = imprt.split(':');
  var info = {};
  var importParts = imprt.split('/');
  var entryParts = entry.split('/');
  var pkgName;

  /**
   * if (AllDependencies.for(importParts[0]).dedupedImports.indexOf(imprt))
   *
   *
   *
   *
   * 
   * var importParts = imprt.split('/');
   * var entryParts = entry.split('/')
   *
   * if (entryParts.length > 1) {
   *
   *  if (entryParts[0] === importParts[0] && entryParts[1] !== importParts[1]) {
   *    
   *  }
   * 
   * }
   * 
   */

  if (importParts[1] === 'tests') {
    pkgName = [importParts[0], importParts[1]].join('/');
  } else {
    pkgName = importParts[0];
  }

  cache = cache || {};

  if (resolverParts.length > 1) {
    info.type = resolverParts[0];
    info.name = resolverParts[1];
    info.pkgName = resolverParts[1].split('/')[0];
  } else if (!cache[pkgName]) {
    info.pkgName = pkgName;
    info.type = 'es';
    info.name = imprt;
  } else if (imprt.indexOf(entry + '/') > -1) {
    info.type = 'ember-app';
    info.pkgName = entry,
    info.name = imprt;
  } else {
    imprt = pkgName + '/' + imprt;
    info.type = 'ember-app';
    info.name = imprt;
    info.pkgName = pkgName;
  }

  return info;
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

function resolvePackage(packageName, basedir) {
  var mainFile = resolve(packageName, { basedir: basedir });
  var splitter = 'node_modules/' + packageName;
  var splitterIndex = mainFile.indexOf(splitter) + splitter.length;
  return mainFile.substring(0, splitterIndex);
}

module.exports = {
  zip: zip,
  uniq: uniq,
  flatMap: flatMap,
  flatten: flatten,
  isEntryFiles: isEntryFiles,
  getImportInfo: getImportInfo,
  arraysEqual: arraysEqual,
  resolvePackage: resolvePackage
};