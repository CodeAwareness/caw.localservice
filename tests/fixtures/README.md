# atom-svelte-transpiler

This project implements an [Atom package transpiler]() that transpiles your package's Svelte files.

## Usage

1. Install the package
2. Add an `atomTranspilers` entry to your `package.json`
3. Install Svelte and have fun

In detail:

**1.** First, install the package from the npm registry:

    npm install --save atom-svelte-transpiler

**2.** Next, modify your `package.json` to include a reference to the transpiler for all Svelte files.

```javascript
{
  ...
  "atomTranspilers": [
    {
      "glob": "**/*.svelte",
      "transpiler": "atom-svelte-transpiler"
    }
  ]
}
```

**3.** Finally, install Svelte and other plugins you may wish:

    npm install --save svelte

### Options

You may specify the following options as values of the `options` object in your `package.json`:

|Option|Default|Description|
|--:|---|---|
|`cacheKeyFiles`|`[]`|An array of files to include when determining whether or not to use the cache. For example, to force a recompile anytime your `.babelrc` changes, add `.babelrc` to this array.|

## Other Details

### Source Maps

To enable source maps within Atom, set the Svelte `sourceMaps` option to `"inline"` in your Babel configuration.
