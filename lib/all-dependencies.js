'use strict';

var Package       = require('./models/package');
var debug         = require('debug')('pre-packager:all-dependencies');
var graphlib      = require('graphlib');
var Graph         = graphlib.Graph;
var difference    = require('lodash-node/modern/array/difference');
var equal         = require('lodash-node/modern/lang/isEqual');
var head          = require('lodash-node/modern/array/head');
var uniq          = require('lodash-node/modern/array/uniq');
var flatten       = require('lodash-node/modern/array/flatten');
var intersection  = require('lodash-node/modern/array/intersection');

function clone(obj) {
  var ret = {};

  Object.keys(obj).forEach(function(item)  {
    ret[item] = obj[item];
  });

  return ret;
}

function byAdjacent(edge) {
  return edge.w;
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
  getDescriptors: function() {
    var packages = Object.keys(this._packages);
    return packages.map(function(name) {
      return this._packages[name].descriptor;
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

  /**
   * Checks to see if a file has been synced yet
   * @param  {String} fileName The filename we would like to check
   * @return {Boolean}
   */
  isSynced: function(fileName) {
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
   * Marks the nodes in the existing graph to not be synced to disk,
   * as this portion of the graph has become unstable and we must re-resolve.
   * @param  {String} packageName the package that is dirty
   * @return {Nil}
   */
  _markAsUnsynced: function(packageName) {
    var nodes = this.byPackageNames([packageName]);
    nodes.forEach(function(node) {
      var meta = this.graph.node(node);
      meta.syncedToDisk = false;
      this.addNode(node, meta);
    }, this);
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

    this._markAsUnsynced(packageName);

    if (fileRemoved) {
      var removedFile = head(difference(currentFiles, newFiles));
      inwardEdges = this.getInwardEdges(removedFile).filter(Boolean);
      // Verify the node does not have edges
      if (inwardEdges > 0) {
        var inwardEdgesByName = inwardEdges.map(this.byName).join(', ');
        throw new Error('Corrupted graph encountered. You removed ' + removedFile + ', but ' + inwardEdgesByName + ' depend on it. Please remove ' + removedFile + ' as a dependency on ' + inwardEdgesByName + '.');
      }
      var outwardEdges = this.getOutwardEdges(removedFile).map(byAdjacent);

      this.graph.removeNode(removedFile);
      this.removeUnreachable(outwardEdges);
    }

    if (fileWithUnstableImports && !fileRemoved) {
      importsRemoved = (currentImports.length > newImports.length);
      if (importsRemoved) {
        removedFileImports = difference(currentImports, newImports);

        this._removeEdges(fileWithUnstableImports, removedFileImports);

        this.removeUnreachable(removedFileImports);
      } else {
        this.setEdge(fileWithUnstableImports, pack.imports[fileWithUnstableImports]);
      }
    }

    pack.updateDependencies(denormalizedGraph);
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

  /**
   * Verifies the removed imports are orphaned and then prunes them from the graph.
   * @param  {Array} removedFileImports The removed imports
   * @return {Nil}
   */
  removeUnreachable: function(removedFileImports) {
    var inwardEdges = removedFileImports.filter(function(removedFile) {
      var edges = this.getInwardEdges(removedFile).filter(Boolean);
      return edges.length > 0;
    }, this);

    var removable = difference(removedFileImports, inwardEdges);
    var removableOutwardEdges = flatten(removable.map(function(edge) {
      return this.getOutwardEdges(edge).map(byAdjacent);
    }, this));

    removable.forEach(function(removedFile) {
      this.getOutwardEdges(removedFile).filter(Boolean).forEach(function(edge) {
        this.graph.removeEdge(edge.v, edge.w);
      }, this);
    }, this);

    if (removableOutwardEdges.length > 0) {
      this.removeUnreachable(removableOutwardEdges);
    }


    this.pruneUnreachable();
  },

  /**
   * Creates a map of arrays where the arrays represent nodes local
   * to a root. It also collects all of the nodes shared between the roots.
   * @return {Object} The local nodes per root
   */
  graphForEngines: function() {
    var engines = {};
    var boundaries = this._graphBoundaries(this.roots);
    var sharedDeps = this._findEngineIntersections(boundaries);
    engines['shared'] = sharedDeps;

    this.roots.forEach(function(root, i) {
      engines[root] = boundaries[i].filter(function(boundary) {
        return sharedDeps.indexOf(boundary) < 0;
      });
    }, this);

    return engines;
  },

  /**
   * Creates a list of lists containing the nodes within a root with
   * any outbound edges to other nodes in a root removed.
   * @param  {Array} roots The roots
   * @return {Array<Array>}       The local node boundaries
   */
  _graphBoundaries: function(roots) {

    var allRootNodes = uniq(flatten(roots.map(function(root) {
      return this.byPackageNames(root);
    }, this)));

    return roots.map(function(root) {
      var subgraph = this.graphFor(root);
      var rootNodes = subgraph.filter(function(node) {
        var meta = this.getNodeMeta(node);

        // Guard against dynamic nodes
        if (!meta || !meta.packageName) {
          return false;
        }

        return meta.packageName === root;
      }, this);

      var localNodes = uniq(flatten(rootNodes.map(function(node) {
        return flatten(this._localNodes(roots, node, root, this.getNodeMeta(node))).concat(node);
      }, this)));

      var transitives = difference(subgraph, allRootNodes);

      return localNodes.concat(transitives);
    }, this);
  },

  /**
   * Finds the intersection between all of the engines. For example
   * Ember will be shared across all engines.
   * @param  {Array<Array>} boundaries List of List boundaries
   * @return {Array}            The intersection of the boundaries
   */
  _findEngineIntersections: function(boundaries) {
    return intersection.apply(null, boundaries);
  },

  /**
   * Prunes away any outward edges to other roots
   * @param  {Array} roots The roots we build from
   * @param  {String} node  A node within a root
   * @param  {String} root  The current root we are pruning from
   * @return {Array<Array>}       The edges that are local
   */
  _localNodes: function(roots, node, root, meta) {
    var rootsToCompare = roots.filter(function(r) {
      return r !== root;
    });

    var outwardEdges = this.getOutwardEdges(node);

    if (outwardEdges.length === 0 && meta.packageName === root) {
      return [node];
    }

    return outwardEdges.filter(function(edge) {
      var meta = this.getNodeMeta(edge.w);

      // Guard against dynamic nodes e.g. npm:jquery -> browserify-bundle
      if (!meta || !meta.packageName) {
        return false;
      }

      var packageName = meta.packageName;
      // Is a local outedge or is not part of a root
      return packageName === root || rootsToCompare.indexOf(packageName) < 0;
    }, this).map(function(edge) {
      return [edge.v, edge.w];
    });
  },


  graphFor: function(entry) {
    var rootNodes = this.byPackageNames(entry);
    return uniq(flatten(rootNodes.map(function(node) {
      return graphlib.alg.postorder(this.graph, node);
    }, this)));
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

    var unreachable = difference(allNodes, reachable);

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
    var name = descriptor.name;

    debug('updating graph with: %s', name);

    denormalizedGraph = Package.removeFileExtensionsFromGraph(denormalizedGraph);
    var imports = Package.flattenImports(denormalizedGraph);

    if (this._packages[name]) {
      this._updateExisting(name, denormalizedGraph);
      return;
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
