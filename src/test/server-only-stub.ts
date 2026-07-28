/**
 * Stands in for Next's `server-only` marker under vitest.
 *
 * The real module has no runtime behaviour at all — it exists so that a build
 * fails loudly when server code is pulled into a client bundle. Under the test
 * runner there is no client bundle and no Next resolver, so importing it fails
 * for want of a package. This empty module is aliased in its place.
 */
export {};
