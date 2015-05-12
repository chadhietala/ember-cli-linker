'use strict';

var resolve = require('resolve').sync;

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

function flatMap(arr, fn, context) {
  return flatten(arr.map(fn), context);
}

function isEntryFiles() {
  return function(relativePath) {
    return relativePath.slice(-1) !== '/';
  };
}

function getImportInfo(imprt, entry) {
  var importParts = imprt.split(':');
  var info = {};
  var pkgName;

  if (importParts.length > 1) {
    info.type = importParts[0];
    info.name = importParts[1];
    info.pkgName = importParts[1].split('/')[0];
  } else if (imprt.indexOf(entry + '/') > -1) {
    info.type = 'addon';
    info.pkgName = entry,
    info.name = imprt;
  } else {
    pkgName = imprt.split('/')[0];
    imprt = pkgName + '/' + imprt;
    info.type = 'addon';
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
  uniq: uniq,
  flatMap: flatMap,
  flatten: flatten,
  isEntryFiles: isEntryFiles,
  getImportInfo: getImportInfo,
  arraysEqual: arraysEqual,
  resolvePackage: resolvePackage
};