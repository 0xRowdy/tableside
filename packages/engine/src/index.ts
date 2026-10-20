// The shared game engine: portable TypeScript that runs unchanged on Node and
// on the app's bundled Hermes. It has no React, Expo, Node-only, network,
// storage, clock, account, advertising or subscription dependency; the app and
// the runner supply adapters. The portability rule is enforced by lint.

/** The engine build's version. Activities will pin it alongside rule and strategy identities. */
export const ENGINE_VERSION = '0.0.0';
