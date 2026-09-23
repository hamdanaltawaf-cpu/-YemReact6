import { createRequire } from 'node:module';
// Reuse Next's exact .env precedence; explicit host environment values win.
// Resolve through our direct Next dependency rather than relying on a hoisted package.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
export function loadAppEnvironment(dev = false) {
  nextRequire('@next/env').loadEnvConfig(process.cwd(), dev);
}
