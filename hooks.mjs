/**
 * Benjamin's ESbuild loader for TypeScript (BESTS)
 *
 * @author Benjamin Gwynn <benjamin@benjamingwynn.com>
 * @format
 */

import esbuild from "esbuild"
import path from "node:path"
import url from "node:url"
import fs from "fs"
import fsp from "fs/promises"
import {getTsconfig} from "get-tsconfig"

const print = (...args) => console.error("\x1b[36m" + "bests\t" + "\x1b[0m", ...args)
const debug = process.env.DEBUG?.includes("bests") ? print : () => {}

// useful for debugging async timings
// const tick = () => {
// 	return new Promise((resolve) => {
// 		setTimeout(() => {
// 			resolve()
// 		}, 1)
// 	})
// }

function findTS(specifier) {
	if (!specifier) return null
	const ts = getTsconfig(specifier)
	if (!ts) return null
	// debug(specifier, "->", ts.path)

	let root = path.join(ts.path, "..")
	if (ts.config.compilerOptions.rootDirs) {
		console.warn("[warn] compilerOptions.rootDirs is not supported/implemented")
	}
	if (ts.config.compilerOptions.baseUrl) {
		console.warn('[warn] compilerOptions.baseUrl is not supported/implemented. @ "' + ts.path + '" from "' + specifier + '"')
	}
	if (ts.config.compilerOptions.rootDir) {
		root = path.join(root, ts.config.compilerOptions.rootDir)
	}

	return {
		tsconfig: ts.config,
		root,
	}
}

/** @public Receives data from `register`. */
export async function initialize() {}

/** @public Take an `import` or `require` specifier and resolve it to a URL. */
export async function resolve(specifier, context, nextResolve) {
	// if we're loading from somewhere
	if (context?.parentURL?.startsWith("file://")) {
		const parentPath = url.fileURLToPath(context.parentURL)

		// if explicitly not a TS file and in node modules, do nothing
		if (path.extname(parentPath) !== ".ts" && parentPath.includes("/node_modules/")) {
			debug("[*!*]", "ignoring:", parentPath)
			return nextResolve(specifier)
		}

		const ts = findTS(parentPath)

		// and we're loading from a typescript location
		if (ts) {
			debug("[...]", context.parentURL, "is trying to load", specifier, "@", ts.root)

			const {tsconfig, root} = ts

			// resolves `paths` from tsconfig to ts files for the loader
			// baseURL is intentionally ignored, don't use this option.
			if (tsconfig.compilerOptions.paths) {
				for (const [importName, sources] of Object.entries(tsconfig.compilerOptions.paths)) {
					if (specifier === importName) {
						for (const source of sources) {
							const maybePath = path.join(root, source)
							try {
								await fsp.access(maybePath, fs.constants.ROK)
							} catch (err) {
								debug("[!!!] error accessing", maybePath, err)
								continue
							}

							const asUrl = url.pathToFileURL(maybePath).href
							return {
								shortCircuit: true,
								url: asUrl,
							}
						}
					} else if (importName.endsWith("/*")) {
						const here = importName.substring(0, importName.length - 1)
						if (specifier.startsWith(here)) {
							const rel = path.relative(here, specifier)

							for (const source of sources) {
								const maybePath = path.join(root, source.substring(0, source.length - 1), rel)

								if (!source.endsWith("/*")) throw new Error("Expected source to end in /*")

								try {
									await fsp.access(maybePath, fs.constants.ROK)
								} catch (err) {
									debug("[!!!] error accessing", maybePath, err)
									continue
								}

								const asUrl = url.pathToFileURL(maybePath).href
								return {
									shortCircuit: true,
									url: asUrl,
								}
							}
						}
					}
				}
			}

			// if the file looks like its relative, and we don't have an extension, try loading a `.ts` file
			if (specifier && specifier.startsWith("./") && path.extname(specifier) === "") {
				const specifier2 = path.join(parentPath, "..", specifier + ".ts")

				try {
					debug("[???] test access", specifier2)
					await fsp.access(specifier2, fs.constants.ROK)
					debug("[ok!] can access", specifier2)
					const asUrl = url.pathToFileURL(specifier2).href

					return {
						shortCircuit: true,
						url: asUrl,
					}
				} catch (err) {
					debug("[[[!!!]]] Cannot access", specifier2, err)
				}
			}
		} else {
			debug("[!!!]", "found no ts root for this ts file:", parentPath)
		}
	}

	// debug("nextResolve:", specifier)
	//await tick()
	return nextResolve(specifier)
}

/** @public Take a resolved URL and return the source code to be evaluated. */
export async function load(resolvedUrl, context, nextLoad) {
	if (resolvedUrl.startsWith("file://")) {
		const resolvedPath = url.fileURLToPath(resolvedUrl)
		if (path.extname(resolvedPath) === ".ts") {
			debug("transforming ts file:", resolvedPath, "...")
			// debug(">>>>> OVERRIDE", resolvedPath)
			const tsRoot = findTS(resolvedPath)
			const tsconfig = tsRoot ? tsRoot.tsconfig : undefined
			if (!tsconfig) {
				console.warn("[warn] the following TS file has no associated tsconfig:", resolvedPath)
			}

			const buffer = await fsp.readFile(resolvedPath)
			const output = await esbuild.transform(buffer, {
				sourcemap: "inline",
				tsconfigRaw: tsconfig,
				sourcefile: resolvedPath,
				platform: "node",
				loader: "ts",
			})
			debug("transformed ts file for:", resolvedPath)

			return {
				format: "module",
				shortCircuit: true,
				source: output.code,
			}
		}
	}

	return nextLoad(resolvedUrl, context)
}
