/**
 * Workerd / CF Workers polyfills for Node.js APIs used by Prisma.
 *
 * Prisma v5 engine initialization calls `fs.readdir` to discover engine
 * binary files. In workerd, unenv's `fs` module doesn't implement `readdir`
 * yet. This polyfill returns an empty array, causing Prisma to fall back
 * to the bundled WASM engine (which is already included in the bundle
 * since `prisma` and `@prisma/client` are NOT in serverExternalPackages).
 *
 * This file must be imported before any Prisma client usage.
 */

// Polyfill fs.readdir for workerd (Cloudflare Workers)
if (typeof (globalThis as any).fs === "undefined") {
  (globalThis as any).fs = {};
}
if (typeof (globalThis as any).fs.readdir !== "function") {
  (globalThis as any).fs.readdir = (
    _path: string,
    callback: (err: Error | null, files?: string[]) => void
  ) => {
    callback(null, []);
  };
}

export {};