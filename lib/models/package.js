'use strict';

var CoreObject = require('core-object');
var array = require('../utils/array');
var path = require('path');
var flatten = array.flatten;

/**
 * The Package class describes a package in the context of the linker.
 * It holds the reference to the denormalized graph and the imports in
 * a given package. In the event the shape of package changes new copies
 * of the denormalized graph and imports are created.
 */
var Package = CoreObject.extend({
  init: function(options) {
    options = options || {};
    this.descriptor = options.descriptor || {};
    this.denormalizedGraph = options.denormalizedGraph || {};
    this.imports = options.imports || {};
  },

  /**
   * One at a time sematics for adding to the denormalized graph
   * @param  {String} importName        The name of the import we are adding
   * @param  {Object} denormalizedSubGraph a sub graph which only describes the import's imports
   * @return {Nil}
   */
  addToDenormalizedGraph: function(importName, denormalizedSubGraph) {
    this.denormalizedGraph[importName] = denormalizedSubGraph;
  },

  /**
   * One at a time semantics for adding to the imports
   * @param {Sting} importName The name of the import we are adding
   * @param {Array} imports  The import's imports
   * @return {Nil}
   */
  addToImports: function (importName, imports) {
    this.imports[importName] = imports;
  },

  /**
   * Updates both the imports and denormalized graph with a new
   * denormalized graph
   * @param  {Object} denormalizedGraph A new denormalized graph
   * @return {Nil}
   */
  updateDependencies: function(denormalizedGraph) {
    this.imports = Package.flattenImports(denormalizedGraph);
    this.denormalizedGraph = denormalizedGraph;
    this.descriptor.updateRelativePaths();
  }
});

/**
 * Normalizes the import names used within the linker
 * @param  {Object} denormalizedGraph A new denormalized graph
 * @return {Object}                   A copy of the denormalized graph with extensions removed
 */
Package.removeFileExtensionsFromGraph = function(denormalizedGraph) {
  var _denormalizedGraph = {};
  Object.keys(denormalizedGraph).forEach(function(file) {
    var importName = _removeFileExtension(file);
    _denormalizedGraph[importName] = denormalizedGraph[file];
  });
  return _denormalizedGraph;
};

/**
 * Creates a flattened imports object
 * @param  {Object} denormalizedGraph A new denormalized graph
 * @return {Object}                   An object where the key is the import and value is an array of imports
 */
Package.flattenImports = function(denormalizedGraph) {
  var imports = {};
  Object.keys(denormalizedGraph).forEach(function(file) {
    var fileName = _removeFileExtension(file);
    var dependency = denormalizedGraph[file];

    imports[fileName] = dependency.imports.map(function(importee) {
      return importee.source;
    });

  });
  return imports;
};

/**
 * Given an object of imports returns an array of imports
 * @example
 *
 * var imports = {
 *   'foo/bar': ['a', 'b', 'c'],
 *   'bizz/buzz': ['d', 'e']
 * };
 *
 * Package.collectImports(imports) -> ['a', 'b', 'c', 'd', 'e']
 *
 * @param  {Object} imports An object were the keys are imports and the values are it's imports
 * @return {Array}         The flattened imports
 */
Package.collectImports = function(imports) {
  return flatten(Object.keys(imports).map(function(file) {
    return imports[file];
  }));
};

/**
 * Gets the name of the package and accounts for NPM's scoped packages.
 * Since tests in the linker are special in that they reside in a seperate
 * tree we must special case them.
 * @param  {String} importName The name of the import we are query on
 * @param  {String} testPackage The name of the package that is used to imports in "/test"
 * @return {String}            The name of the package
 */
Package.getName = function(importName, testPackage) {
  var hasScope = importName.charAt(0) === '@';
  var importParts = importName.split(path.sep);
  var notTests = importName.indexOf('/tests') < 0;


  if (hasScope) {
    return [importParts[0], importParts[1]].join(path.sep);
  }

  if (notTests) {
    return importParts[0];
  } else if (testPackage) {
    return testPackage;
  }
};

function _removeFileExtension(file) {
  return file.replace(path.extname(file), '');
}

module.exports = Package;
