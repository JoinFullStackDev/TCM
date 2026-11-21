/**
 * Lets `node --test` (Node 22.18+, which strips TypeScript types natively) load the
 * app's TypeScript modules without a bundler: resolves extensionless relative imports
 * and the `@/` path alias to `.ts` files. Used by `npm test`; needs no dependencies.
 */
import { register } from 'node:module';
import path from 'node:path';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const SRC = ${JSON.stringify(path.resolve(import.meta.dirname, '../src'))};
const exts = ['.ts', '.tsx', '/index.ts'];
export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith('@/')) base = path.join(SRC, specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:'))
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  if (base && !path.extname(base)) {
    for (const ext of exts) {
      if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, context);
    }
  }
  if (base && specifier.startsWith('@/')) return next(pathToFileURL(base).href, context);
  return next(specifier, context);
}
`),
  import.meta.url,
);
