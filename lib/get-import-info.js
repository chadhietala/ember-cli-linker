'use strict';
var Import = require('./models/import');

function getImportInfo(descriptors, packageName, importee, importer) {
  var descriptor = descriptors[packageName];
  var resolverParts = importee.split(':');
  var dependencyOfImporter = descriptors[importer].pkg.dependencies[packageName]; 

  if (descriptor) {
    return appOrAddon(descriptor, importer, importee);
  } else if (resolverParts.length > 1) {
    return customImport(importer, resolverParts);
  } else if (dependencyOfImporter) {
    return esFromNodeModules(importer, packageName, importee);
  } else {
    throw new Error('Cannot generate import information.');
  }
}

module.exports = getImportInfo;

function customImport(importer, resolverParts) {
  var packageName = getPackageName(resolverParts[1]);

  return new Import({
    importer: importer,
    pkgName: packageName,
    name: resolverParts[1],
    type: resolverParts[0]
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

  if (!contains(file, relativePaths) && contains(addonFile, relativePaths)) {
    importee = addonImportPath;
  }

  return new Import({
    importer: importer,
    pkgName: descriptor.name,
    name: importee,
    type: 'ember-app'
  });
}

function contains(item, arr) {
  return arr.indexOf(item) > -1;
}

function getPackageName(importee, importer) {
  var importParts = importee.split('/');

  if (importee.indexOf('/tests') < 0) {
    return importParts[0];
  } else {
    return importer;
  }
}