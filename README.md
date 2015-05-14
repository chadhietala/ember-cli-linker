# Ember CLI Pre-Packager

[![Build Status][travis-badge]][travis-badge-url] [![Coverage Status](https://coveralls.io/repos/chadhietala/ember-cli-pre-packager/badge.svg?branch=coveralls)](https://coveralls.io/r/chadhietala/ember-cli-pre-packager?branch=coveralls)

The __Pre-Packager__ is the soon to be resolution phase for the Ember CLI build process. It's primary concern is resolving dependencies in a project and outputing a tree that represents the dependency graph.  This tree would then be passed to the __Packager__ that allows for declarative concatenation strategies. The resolution occurs via __dependency resolvers__. Out of the box the pre-packger has 3 depedency resolvers, __addon__, __npm__, and __esnext__, however the resolvers are dynamically looked up which creates a nice charateristic of modularity for resolving different types.

## High Level Design

The input to the pre-packager is an array of trees that looks like the following:

```
input-tree/
├── ember
│   ├── dep-graph.json
│   └── ember.js
├── ember-load-initializers
│   ├── dep-graph.json
│   └── ember-load-initializers.js
├── ember-moment
│   ├── computed.js
│   ├── computeds
│   │   ├── ago.js
│   │   ├── duration.js
│   │   └── moment.js
│   ├── dep-graph.json
│   └── helpers
│       ├── ago.js
│       ├── duration.js
│       └── moment.js
├── ember-resolver
│   ├── dep-graph.json
│   └── ember-resolver.js
└── example-app
    ├── app.js
    ├── config
    │   └── environment.js
    ├── dep-graph.json
    ├── initializers
    │   └── ember-moment.js
    └── router.js
```

The build step prior to the pre-packager simply discovers the app and addons in your project transpiles them to amd. As a result of this it should leave a `dep-graph.json` per package in the output tree.

Instead of re-parsing all of the files in the tree to construct a dependency graph we take advantage of the fact that esperanto can give us a map of all of a packages depenendencies.  This map looks something like the following:

```js
{
  "example-app/app.js": {
    "imports": [
      "exports",
      "ember",
      "ember-resolver",
      "ember-load-initializers",
      "example-app/config/environment"
    ]
  },
  "example-app/initializers/ember-moment.js": {
    "imports": [
      "exports",
      "ember-moment/helpers/moment",
      "ember-moment/helpers/ago",
      "ember-moment/helpers/duration",
      "ember"
    ]
  },
  "example-app/router.js": {
    "imports": [
      "exports",
      "ember",
      "example-app/config/environment"
    ]
  }
}
```

This gives us enough information to enter into a resolution phase.

### Resolution of addons

The algorithm for resolving and syncing files into the output tree is as follows:

1. Sync forward all of the entry's files.
2. Map over the imports syncing the file to the output tree
3. Read in the import's corresponding dep-graph.json for the import in the interation grabbing it's imports (transitives).
4. Back to 2 with the imports (transitives) and continue till all of the entries imports have been synced.

### Resolution of legacy npm modules

In the event the application is using "legacy" JavaScript modules a la CJS, they should be prefixed with `npm:` when they are used in the addon or applcation.

The way legacy modules are resolved is different. Since we cannot construct a dep-graph.json ahead of time, we rely on browserify's ability to handle this for us. Since there is probablity that addons or apps may pull in the same legacy module we wait till the resolution of addons is complete. This allows for the stub amd files to be aggregated and deduped.

The cache key here is layered from least expensive to most expensive:

- If we have never seen the module we build
- If we've seen the module but the stubs are different we build
- Finally, if the hashed contents of the module are different we build

This strategy allows for imports from the same module to be added/removed/swapped and the built module to retain the parity of the graph.

[travis-badge]: https://travis-ci.org/chadhietala/ember-cli-pre-packager.svg?branch=master
