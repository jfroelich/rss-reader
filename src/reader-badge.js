'use strict';

// import rbl.js
// import extension.js
// import reader-db.js

// @throws {AssertionError}
// @throws {Error} database related
async function readerBadgeUpdate(conn) {
  extensionSetBadgeText(await readerDbCountUnreadEntries(conn));
}
