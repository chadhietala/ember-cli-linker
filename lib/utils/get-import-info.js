'use strict';
var Import = require('../models/import');

function getImportInfo(descriptors, packageName, importee, importer) {
  var descriptor = descriptors[packageName];
  var resolverParts = importee.split(':');
  var isCustomResolver = resolverParts.length > 1;
  var dependencyOfImporter;
  if (descriptors[importer].pkg.dependencies) {
    dependencyOfImporter = descriptors[importer].pkg.dependencies[packageName];
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

module.exports = getImportInfo;

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
  var importParts = importee.split('/');

  if (importee.indexOf('/tests') < 0) {
    return importParts[0];
  } else {
    return importer;
  }
}