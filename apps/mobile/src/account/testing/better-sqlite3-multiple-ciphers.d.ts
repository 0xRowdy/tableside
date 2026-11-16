// The package's own typings sit outside its "exports" map, so TypeScript can't
// resolve them; its API is better-sqlite3's, so it borrows those types.
declare module 'better-sqlite3-multiple-ciphers' {
  // Only @types/better-sqlite3 is installed (types, no JavaScript), which the import resolver can't see.
  // eslint-disable-next-line import/no-unresolved
  import Database from 'better-sqlite3';
  export = Database;
}
