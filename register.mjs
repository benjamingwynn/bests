/** @format */

import {register} from "node:module"
import path from "node:path"
import url from "node:url"

const x = path.join(url.fileURLToPath(import.meta.url), "..", "./hooks.mjs")
console.log("x:", x)

register(url.pathToFileURL(x))
