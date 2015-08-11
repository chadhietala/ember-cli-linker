# Ember CLI Linker

[![Build Status][travis-badge]][travis-badge-url] [![Coverage Status](https://coveralls.io/repos/chadhietala/ember-cli-linker/badge.svg?branch=coveralls)](https://coveralls.io/r/chadhietala/ember-cli-linker?branch=coveralls)

The __Linker__ is the soon to be resolution phase for the Ember CLI build
process. It's primary concern is resolving dependencies in a project and
outputing a tree that represents the dependency graph.  This tree would then be
passed to the __Packager__ that allows for declarative concatenation
strategies. The resolution occurs via __dependency resolvers__. Out of the box
the pre-packger has 3 dependency resolvers, __addon__, __npm__, and __esnext__,
however the resolvers are dynamically looked up which creates a nice
charateristic of modularity for resolving different types.

## High Level Design

The input to the linker is an array of trees. The build step prior to the
linker simply discovers the app and addons in your project transpiles them to
amd. As a result of this it should leave a `dep-graph.json` per package in the
output tree.

Instead of re-parsing all of the files in the tree to construct a dependency
graph we take advantage of the fact that babel can give us a map of all of a
packages dependencies.  This map looks something like the following:

```js
{
  "example-app/app.js": {
    "exports": {
      "exported": [],
      "specifiers": []
    },
    "imports": [
      {
        "imported": [
          "default"
        ],
        "source": "ember",
        "specifiers": [
          {
            "imported": "default",
            "kind": "named",
            "local": "Ember"
          }
        ]
      },
      {
        "imported": [
          "default"
        ],
        "source": "ember-resolver",
        "specifiers": [
          {
            "imported": "default",
            "kind": "named",
            "local": "Resolver"
          }
        ]
      },
      {
        "imported": [
          "default"
        ],
        "source": "ember-load-initializers",
        "specifiers": [
          {
            "imported": "default",
            "kind": "named",
            "local": "loadInitializers"
          }
        ]
      },
      {
        "imported": [
          "default"
        ],
        "source": "example-app/config/environment",
        "specifiers": [
          {
            "imported": "default",
            "kind": "named",
            "local": "config"
          }
        ]
      }
    ]
  }
  ...
}
```

This gives us enough information to enter into a resolution phase.

### Resolution of addons

The algorithm for resolving and syncing files into the output tree is as
follows:

1. Sync forward all of the entry's files.
2. Map over the imports syncing the file to the output tree
3. Read in the import's corresponding dep-graph.json for the import in the
   interation grabbing it's imports (transitives).
4. Back to 2 with the imports (transitives) and continue till all of the
   entries imports have been synced.

### Resolution of ES2015 Modules

With addons, we know all of the addon namespaces in which modules could come
from. For example `import ago from 'ember-moment/helpers/ago';` is going to
come from the `ember-moment` addon. This allows us to make a clear delineation
between if an import is an addon or not.  In the case that the import is not an
addon, we take the modules namespace and use the module resolution algorithm to
see if a package exists for the namespace.  If there is we then further check
for the "jsnext:main" convention in it's package.json.  If both of those cases
are true we know we are dealing with an ES6 module.

Using Babel we compile the file. At the end of each compilation we are given
the same import/export data structure and we then use that to recurse to
resolve the graph.

### Resolution of legacy npm modules

In the event the application is using "legacy" JavaScript modules a la CJS,
they should be prefixed with `npm:` when they are used in the addon or
application.

The way legacy modules are resolved is different. Since we cannot construct a
dep-graph.json ahead of time, we rely on browserify's ability to handle this
for us. Since there is probability that addons or apps may pull in the same
legacy module we wait till the resolution of addons is complete. This allows
for the stub amd files to be aggregated and deduped.

The cache key here is layered from least expensive to most expensive:

- If we have never seen the module we build
- If we've seen the module but the stubs are different we build
- Finally, if the hashed contents of the module are different we build

This strategy allows for imports from the same module to be
added/removed/swapped and the built module to retain the parity of the graph.

[travis-badge]: https://travis-ci.org/chadhietala/ember-cli-linker.svg?branch=master
[travis-badge-url]: https://travis-ci.org/chadhietala/ember-cli-linker
