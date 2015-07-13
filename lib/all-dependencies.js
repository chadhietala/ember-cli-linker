'use strict';

var Package       = require('./models/package');
var Descriptor    = require('./models/descriptor');
var array         = require('./utils/array');
var debug         = require('debug')('pre-packager');
var path          = require('path');
var graphlib      = require('graphlib');
var Graph         = graphlib.Graph;
var without       = array.without;
var flatten       = array.flatten;
var equal         = array.equal;
var head          = array.head;
var uniq          = array.uniq;

function clone(obj) {
  var ret = {};

  Object.keys(obj).forEach(function(item)  {
    ret[item] = obj[item];
  });

  return ret;
}

var AllDependencies = {
  _packages: {},
  graph: new Graph(),

  /**
   * Retrieves the meta data from a node
   * @param  {String} node The node in which we would like meta data from
   * @return {Object|Array}      Either a meta object or array of meta objects
   */
  getNodeMeta: function(node) {
    if (Array.isArray(node)) {
      return node.map(function (n) {
        return this.graph.node(n);
      }, this);
    }

    return this.graph.node(node);
  },

  /**
   * Retrieves inward edges to a node
   * @param  {String} node The node in which we would like edges from
   * @return {Array}       The array of edges
   */
  getInwardEdges: function(node) {
    var edge = this.graph.inEdges(node);

    if (edge) {
      return edge;
    }
    return [];
  },

  getOutwardEdges: function(node) {
    var edge = this.graph.outEdges(node);

    if (edge) {
      return edge;
    }

    return [];
  },

  /**
   * Creates a name, source path pair for each package
   * @return {Array}
   */
  getPackagePathsAndNames: function() {
    var packages = Object.keys(this._packages);
    return packages.map(function(name) {
      return [name, this._packages[name].descriptor.srcDir];
    }, this);
  },

  /**
   * Adds nodes to the graph and sets edges to any head nodes.
   * @param  {String} tail  The tail node
   * @param  {Array} heads Any head nodes to set the edge on
   * @param  {Object} label Arbitary meta data to attach to the node
   * @return {Nil}
   */
  sync: function(tail, heads, label) {
    if (!this.getNodeMeta(tail)) {
      if (label.mainMapping) {
        tail = head(label.mainMapping);
        this.graph.setNode(tail, label);
      } else {
        this.graph.setNode(tail, label);
      }
    }

    this.setEdge(tail, heads);
  },

  /**
   * Sets the edges on a tail node
   * @param  {String} tail  The tail node
   * @param  {Array} heads The head nodes to set the edge on
   * @return {Nil}
   */
  setEdge: function(tail, heads) {
    if (heads) {
      heads.forEach(function(head) {
        this.graph.setEdge(tail, head);
      }, this);
    }
  },

  /**
   * Adds a node to the graph with a label
   * @param  {String} node  The name of the node
   * @param  {Object} label Metadata about the node
   * @return {Nil}
   */
  addNode: function(node, label) {
    this.graph.setNode(node, label);
  },

  /**
   * Retrieves edges by a specific type
   * @param  {String} type The node types we are looking for
   * @return {Array}      Array of nodes for a specific type
   */
  byType: function(type) {
    return this.graph.nodes().filter(function(node) {
      var prefixedType = node.split(':')[0];
      var nodeMeta = this.graph.node(node);
      var t = nodeMeta && nodeMeta.type ? nodeMeta.type : false;
      return t === type || prefixedType === type;
    }, this);
  },

  /**
   * Retrieves the synced packages
   * @return {Array} The package names
   */
  getSyncedPackages: function() {
    return uniq(this.graph.nodes().map(function(node) {
      var meta = this.getNodeMeta(node);
      if (meta && meta.packageName) {
        return meta.packageName;
      } else {
        return false;
      }
    }, this).filter(Boolean));
  },

  /**
   * Retrieves nodes by package name
   * @param  {Array} packageNames
   * @return {Array} nodes in the packages
   */
  byPackageNames: function(packageNames) {
    if (packageNames.length === 0) {
      return packageNames;
    }

    return this.graph.nodes().filter(function(node) {
      var meta = this.graph.node(node);
      return meta && packageNames.indexOf(meta.packageName) > -1;
    }, this);
  },

  // TODO this probably can be removed or functionality exists elsewhere
  _normalizeFileName: function(fileName) {
    return fileName.replace(path.extname(fileName), '');
  },

  /**
   * Checks to see if a file has been synced yet
   * @param  {String} fileName The filename we would like to check
   * @return {Boolean}
   */
  isSynced: function(fileName) {
    fileName = this._normalizeFileName(fileName);
    var meta = this.getNodeMeta(fileName);
    return !!meta && !!meta.syncedToDisk;
  },

  /**
   * One at a time semantics for building up a fully qualified Package model
   * @param  {Object} descriptor        An instance of a descriptor
   * @param  {String} importName        The name of the import we are adding to the package
   * @param  {Object} denormalizedSubGraph A sub graph which is just the imports import's
   * @return {Nil}
   */
  add: function(descriptor, importName, denormalizedSubGraph) {
    debug('adding import: %s', importName);
    var name = descriptor.packageName;
    var _denormalizedGraph = {};
    _denormalizedGraph[importName] = denormalizedSubGraph;
    var flattenImports = Package.flattenImports(_denormalizedGraph);
    var imports = Package.collectImports(flattenImports);
    var pack;

    if (!this._packages[name]) {
      pack = this._packages[name] = new Package({
        descriptor: descriptor
      });
    } else {
      pack = this._packages[name];
    }

    pack.addToDenormalizedGraph(importName, denormalizedSubGraph);
    pack.addToImports(importName, imports);
  },

  /**
   * Determines how the graph was mutated and then prunes the nodes from the graph
   * @param  {String} packageName       The mutated package
   * @param  {Object} currentImportHash The current imports
   * @param  {Object} newImportHash     The incoming imports
   * @param  {Object} denormalizedGraph The denormalized graph for the package
   * @return {Nil}
   */
  _diffSynced: function(packageName, currentImportHash, newImportHash, denormalizedGraph) {
    var currentFiles = Object.keys(currentImportHash).sort();
    var newFiles = Object.keys(newImportHash).sort();
    var fileRemoved = currentFiles.length > newFiles.length;
    var removedFileImports = [];
    var fileWithUnstableImports = head(currentFiles.filter(function(file) {
      return !equal(currentImportHash[file], newImportHash[file]);
    }));
    var currentImports = currentImportHash[fileWithUnstableImports];
    var newImports = newImportHash[fileWithUnstableImports];
    var pack = this._packages[packageName];
    var importsRemoved;
    var inwardEdges;

    if (fileRemoved) {
      var removedFile = head(without(currentFiles, newFiles));
      inwardEdges = this.getInwardEdges(removedFile).filter(Boolean);
      // Verify the node does not have edges
      if (inwardEdges > 0) {
        var inwardEdgesByName = inwardEdges.map(this.byName).join(', ');
        throw new Error('Corrupted graph encountered. You removed ' + removedFile + ', but ' + inwardEdgesByName + ' depend on it. Please remove ' + removedFile + ' as a dependency on ' + inwardEdgesByName + '.');
      }

      this.graph.removeNode(removedFile);
      this.pruneUnreachable();
      this.removeUnreachableInwardEdges([removedFile]);
    }

    pack.updateDependencies(denormalizedGraph);

    if (fileWithUnstableImports) {
      importsRemoved = (currentImports.length > newImports.length);
      if (importsRemoved) {
        removedFileImports = without(currentImports, newImports);

        this._removeEdges(fileWithUnstableImports, removedFileImports);

        this.pruneUnreachable();
        this.removeUnreachableInwardEdges(removedFileImports);
      } else {
        this.setEdge(fileWithUnstableImports, pack.imports[fileWithUnstableImports]);
      }
    }
  },

  /**
   * Sets the root packages
   * @param  {Array} roots The root package names
   * @return {Nil}
   */
  setRoots: function(roots) {
    this.roots = roots;
  },

  /**
   * Removes edges for a given node
   * @param  {String} node         The node we are prune edges from
   * @param  {Array} removalNodes The tail nodes we are removing
   * @return {Nil}
   */
  _removeEdges: function(node, removalNodes) {
    removalNodes.forEach(function(removalNode) {
      this.graph.removeEdge(node, removalNode);
    }, this);
  },

  removeUnreachableInwardEdges: function(removedFileImports) {
    var inwardEdges = removedFileImports.filter(function(removedFile) {
      var edges = this.getInwardEdges(removedFile).filter(Boolean);
      return edges.length > 0;
    }, this);

    if (inwardEdges.length === 0) {
      removedFileImports.forEach(function(removedFile) {
        this.getOutwardEdges(removedFile).filter(Boolean).forEach(function(edge) {
          this.graph.removeEdge(edge.v, edge.w);
        }, this);
      }, this);

      this.pruneUnreachable();
    }
  },

  /**
   * Discovers the reachable nodes from the root nodes via
   * the postorder algorithm and then removes the unreachable nodes.
   * @return {Nil}
   */
  pruneUnreachable: function() {
    var rootNodes = this.byPackageNames(this.roots);
    var allNodes = this.graph.nodes();

    var reachable = uniq(flatten(rootNodes.map(function(node) {
      return graphlib.alg.postorder(this.graph, node);
    }, this)));

    var unreachable = without(allNodes, reachable);

    unreachable.forEach(function(node) {
      this.graph.removeNode(node);
    }, this);
  },

  /**
   * Updates an existing package and prunes the graph of unreachable nodes if neccessary
   * @param  {String} packageName  The mutated package we are updating
   * @param  {String} denormalizedGraph The new copy of denormalized graph
   * @return {Nil}
   */
  _updateExisting: function(packageName, denormalizedGraph) {
    var pack = this._packages[packageName];

    if (pack) {
      var currentImportHash = clone(pack.imports);
      var newImportHash = Package.flattenImports(denormalizedGraph);

      this._diffSynced(packageName, currentImportHash, newImportHash, denormalizedGraph);

    } else {
      throw new Error('Attempted to update ' + packageName + ' that has never been resolved.');
    }
  },

  /**
   * Updates or creates new package instances.
   * @param  {Object} descriptor        A tree descriptor
   * @param  {Object} denormalizedGraph A denormalized graph for a package. Contains information about imports
   * @return {Nil}
   */
  update: function(descriptor, denormalizedGraph) {
    if (arguments.length === 1 && typeof arguments[0] !== 'object') {
      throw Error('You must pass a descriptor and a dependency graph.');
    }
    var name = descriptor.packageName;

    debug('updating graph with: %s', name);

    denormalizedGraph = Package.removeFileExtensionsFromGraph(denormalizedGraph);
    var imports = Package.flattenImports(denormalizedGraph);

    if (this._packages[name]) {
      this._updateExisting(name, denormalizedGraph);
      return;
    }

    if (!(descriptor instanceof Descriptor)) {
      descriptor = new Descriptor(descriptor);
    }

    this._packages[name] = new Package({
      descriptor: descriptor,
      denormalizedGraph: denormalizedGraph,
      imports: imports,
    });
  },

  /**
   * Given either a package name or file you will
   * be returned either the graph for the package
   * or a list of the imports for the file.
   *
   * @param  {String} fileOrPackage
   * @return {Map|List}
   */
  for: function(fileOrPackage, parent) {
    var pack = this._packages[fileOrPackage];
    var isRequestingPackage = pack && !parent;
    var isRequestingFileInPackage = !pack && this._packages[parent];
    var isRequestingMainFile = fileOrPackage === parent;

    if (isRequestingPackage) {
      return pack;
    } else if (isRequestingFileInPackage) {
      return this._packages[parent].imports[fileOrPackage] || [];
    } else if (isRequestingMainFile) {
      return this._packages[parent].imports[fileOrPackage];
    } else {
      return null;
    }

  }
};

module.exports = AllDependencies;
