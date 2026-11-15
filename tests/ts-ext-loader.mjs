import {register} from "node:module";
import {pathToFileURL} from "node:url";
import {existsSync} from "node:fs";
import {dirname, join} from "node:path";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !specifier.match(/\.[a-z]+$/)) {
    const parent = context.parentURL ? new URL(context.parentURL).pathname : process.cwd();
    for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
      const candidate = specifier + ext;
      const from = parent.endsWith("/") ? parent : dirname(parent);
      const full = join(from, candidate);
      if (existsSync(full)) return nextResolve(candidate, context);
    }
  }
  return nextResolve(specifier, context);
}
