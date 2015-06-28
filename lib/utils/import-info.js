'use strict';
var Import = require('../models/import');
var debug = require('debug')('get-import-info');
var path = require('path');

function getImportInfo(descriptors, packageName, importee, importer) {
  debug('importee: %s', importee);
  debug('packageName: %s', packageName);
  var descriptor = descriptors[packageName];
  var resolverParts = importee.split(':');
  var isCustomResolver = resolverParts.length > 1;
  var dependencyOfImporter;
  var pkg = descriptors[importer].pkg;

  if (pkg.dependencies) {
    dependencyOfImporter = pkg.dependencies[packageName];
  } else if (pkg.devDependencies) {
    dependencyOfImporter = pkg.devDependencies[packageName];
  }

  if (descriptor) {
    return appOrAddon(descriptor, importer, importee);
  } else if (isCustomResolver) {
    return customImport(descriptors[importer], importer, resolverParts);
  } else if (dependencyOfImporter) {
    return esFromNodeModules(importer, packageName, importee);
  } else {
    throw new Error('Cannot generate import information for ' + importee +'. Please make sure ' + importee + ' is a dependency of ' + importer + '.');
  }
}

function customImport(descriptor, importer, resolverParts) {
  var packageName = getPackageName(resolverParts[1]);
  var name = resolverParts[1];
  var type = resolverParts[0];

  return new Import({
    importer: importer,
    packageName: packageName,
    name: name,
    type: type
  });
}

function esFromNodeModules(importer, packageName, importee) {
  return new Import({
    importer: importer,
    packageName: packageName,
    name: importee,
    type: 'es'
  });
}

function appOrAddon(descriptor, importer, importee) {
  return new Import({
    importer: importer,
    packageName: descriptor.packageName,
    name: importee,
    type: 'ember-app'
  });
}

function getPackageName(importee, importer) {
  var hasScope = importee.charAt(0) === '@';
  var importParts = importee.split(path.sep);
  var notTests = importee.indexOf('/tests') < 0;

  if (hasScope) {
    return [importParts[0], importParts[1]].join(path.sep);
  }

  if (notTests) {
    return importParts[0];
  } else if (importer) {
    return importer;
  }
}

module.exports = {
  getImportInfo: getImportInfo,
  getPackageName: getPackageName
};
