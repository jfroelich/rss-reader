'use strict';

// import base/assert.js
// import base/errors.js
// import extension.js
// import reader-db.js

// @throws {AssertionError}
// @throws {Error} database related
async function readerUpdateBadge(conn) {
  assert(indexedDBIsOpen(conn));
  // Allow errors to bubble
  const count = await readerDbCountUnreadEntries(conn);
  console.debug('unread count is', count);
  extensionSetBadgeText(count);
}
