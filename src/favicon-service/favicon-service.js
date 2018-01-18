import * as db from "/src/favicon-service/db.js";
import lookupImpl from "/src/favicon-service/lookup.js";

// The favicon service provides the ability to lookup the url of a favicon for a given
// web page. Lookups can optionally be cached in a database so that future lookups
// resolve more quickly and avoid repeated network requests. The cache can be cleared
// or compacted for maintenance.

// Open a connection to the favicon database. Returns a promise that resolves to an
// IDBDatabase instance
export const open = db.open;

// Clear the favicon database
export const clear = db.clear;

// Compact the favicon database
export const compact = db.compact;

// Lookup a favicon for a given url
export const lookup = lookupImpl;
