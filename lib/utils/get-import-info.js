'use strict';
var Import = require('../models/import');
var contains = require('./array').contains;

function getImportInfo(descriptors, packageName, importee, importer) {
  var descriptor = descriptors[packageName];
  var resolverParts = importee.split(':');
  var dependencyOfImporter = descriptors[importer].pkg.dependencies[packageName]; 

  if (descriptor) {
    return appOrAddon(descriptor, importer, importee);
  } else if (resolverParts.length > 1) {
    descriptor = descriptors[importer];
    return customImport(descriptor, importer, resolverParts);
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
    pkgName: packageName,
    name: name,
    type: type
  });
}

function esFromNodeModules(importer, packageName, importee) {
  return new Import({
    importer: importer,
    pkgName: packageName,
    name: importee,
    type: 'es'
  });
}

function appOrAddon(descriptor, importer, importee) {
  var addonImportPath = descriptor.name + '/' + importee;
  var addonFile = addonImportPath + '.js';
  var file = importee + '.js';
  var relativePaths = descriptor.relativePaths;

  if (!contains(relativePaths, file) && contains(relativePaths, addonFile)) {
    importee = addonImportPath;
  }

  return new Import({
    importer: importer,
    pkgName: descriptor.name,
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