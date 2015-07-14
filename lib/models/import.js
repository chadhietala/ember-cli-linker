'use strict';

var CoreObject = require('core-object');
var path = require('path');
var existsSync = require('exists-sync');
var getPackageName = require('./package').getName;

/**
 * The Import class describes and import node and it's importer.
 * Instances of this class are used to inform the graph about new
 * edges added to the graph. In the graph the importName is the tail
 * node and the importer is the head.
 */
var Import = CoreObject.extend({
  init: function(options) {
    this.importer = options.importer;
    this.importerPackageName = options.importerPackageName;
    this.packageName = options.packageName;
    this.importName = options.importName;
    this.type = options.type;
  }
});

/**
 * Creates and verfies file paths on disk
 * @param  {Object} options
 * @property {String} options.file The file we are querying for
 * @property {Object} options.pkg The package.json for the file
 * @property {String} options.destination The path we will eventually write to
 * @property {String} options.destination The file extension for the files
 * @property {String} [options.tmpRoot] A temp directory that contains a traspiled source
 * @return {Object}   An object containing normalized file names and concrete paths
 */
Import.getConcretePaths = function(options) {
  var file = options.file;
  var pkg = options.pkg;
  var destination = options.destination;
  var tmpRoot = options.tmpRoot;
  var ext = options.ext;
  var nodeModulesPath = options.nodeModulesPath;
  var concreteFileName = Import.getNormalizedFileName(pkg, file);
  var importPath;

  // Ensure we are dealing with a file with an extension
  if (path.extname(concreteFileName) === '') {
    concreteFileName = concreteFileName + ext;
  }

  importPath = path.join(nodeModulesPath, concreteFileName);

  if (!existsSync(importPath)) {
    throw new Error('The import ' + file + ' does not exist at ' + importPath + '. This is a problem with the Ember CLI Linker. Please file a bug.');
  }

  var paths = {
    relativePath: _getRelativePath(concreteFileName),
    destinationPath: path.join(destination, concreteFileName),
    tmpPath: tmpRoot ? path.join(tmpRoot, concreteFileName) : null,
    importPath: importPath
  };

  if (_isMainFile(pkg, file)) {
    paths.file = concreteFileName;
    paths.basePath = path.dirname(concreteFileName) + path.sep;
    paths.isMain = true;
    paths.mainMapping = [file, concreteFileName];
  } else {
    concreteFileName = concreteFileName + ext;
    paths.file = concreteFileName;
    paths.basePath = null;
    paths.isMain = false;
  }

  return paths;
};

/**
 * Normalizes file names
 * @param  {Object} pkg  A package.json that is used to lookup the main file
 * @param  {String} file The name of a file we wish to normalize
 * @return {String}      The normalized name
 */
Import.getNormalizedFileName = function(pkg, file) {
  if (_isMainFile(pkg, file)) {
    return _getNormalizedMainFile(pkg, file);
  }

  return file;
};

/**
 * Based on several heuristics create an Import class that contains
 * meta data related to the import.
 * @param  {Object} descriptors The tree descriptors which are passed to the linker
 * @param  {Object} meta        Known information about an import
 * @return {Object}             An instance of the Import model
 */
Import.getInfo = function(descriptors, meta) {
  var importee = meta.importName;
  var packageName = meta.packageName;
  var importerPackageName = meta.importerPackageName;
  var descriptor = descriptors[packageName];
  var resolverParts = importee.split(':');
  var isCustomResolver = resolverParts.length > 1;
  var esDepedency;
  var pkg = descriptors[importerPackageName].pkg;

  if (pkg.dependencies) {
    esDepedency = pkg.dependencies[packageName];
  } else if (pkg.devDependencies) {
    esDepedency = pkg.devDependencies[packageName];
  }

  if (descriptor) {
    return appOrAddon(meta);
  } else if (isCustomResolver) {
    return customImport(resolverParts, meta);
  } else if (esDepedency) {
    return esFromNodeModules(meta);
  } else {
    throw new Error('Cannot generate import information for ' + importee +'. Please make sure ' + importee + ' is a dependency of ' + importerPackageName + '.');
  }
};

function _getNormalizedMainFile(pkg, file) {
  if (pkg['jsnext:main']) {
    return path.join(pkg.name, pkg['jsnext:main']);
  } else if (pkg.main) {
    return path.join(pkg.name, pkg.main);
  } else {
    throw new Error('Attempted to lookup the concrete file name for the ' + file  + ' main file, but did not find one. Please make sure that the import ' + file + ' has a package.json that has either a jsnext:main or main field which points to the main file.');
  }
}

function _isMainFile(pkg, file) {
  return pkg.name === file;
}

function _getRelativePath(file) {
  var ext = path.extname(file);
  if (ext !== '') {
    return file.replace(ext, '');
  }

  return file;
}

function customImport(resolverParts, meta) {
  var packageName = getPackageName(resolverParts[1]);
  var name = resolverParts[1];
  var type = resolverParts[0];

  meta.packageName = packageName;
  meta.importName = name;
  meta.type = type;

  return new Import(meta);
}

function esFromNodeModules(meta) {
  meta.type = 'es';
  return new Import(meta);
}

function appOrAddon(meta) {
  meta.type = 'ember-app';
  return new Import(meta);
}

module.exports = Import;
