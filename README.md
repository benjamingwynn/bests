# Benjamin's ESbuild loader for TypeScript (B.ES.TS.)

node.js loader for TypeScript using ESBuild, for my personal projects

allows you to run typescript files in node.js via the esbuild transform API, so that typescript files can be imported natively in node.js.

there are plenty of tools that do this, but this one:

- works with `paths` in your tsconfig for defining aliases, just like esbuild
- builds and includes a sourcemap when loading typescript files, so stack traces aren't obfuscated
- always uses the correct tsconfig for the file
	- this means it works with project references/different `import` specifications for different source files
	- files are always transformed with their correct tsconfig passed to esbuild, so similar path aliases across linked projects work properly
- takes advantage of the [module hooks API](https://nodejs.org/api/module.html#customization-hooks)
	- works with node's native `--watch` argument
	- works with node's native test runner (`--test`)
- intentionally ignores other options from tsconfig when resolving files, like the unrecommended [baseUrl](https://www.typescriptlang.org/tsconfig#baseUrl)

## Installation

Install with your package manager of choice from [npm](https://www.npmjs.com/package/bests):

```
npm i --save-dev bests
```

or [Github](https://github.com/benjamingwynn/bests):

```
npm i --save-dev benjamingwynn/bests
```

## Usage

You can either use bests with node.js directly on the command line like so:

```
node --import bests --enable-source-maps <extra node arguments> <path to ts file>
```

Or use the runner program

```
npx bests <extra node arguments> <path to ts file>
```

If you want to restart on file change, add `--watch` to the node arguments to either command.