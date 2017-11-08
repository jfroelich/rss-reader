'use strict';

// import rbl.js
// import extension.js
// import reader-db.js

// @throws {AssertionError}
// @throws {Error} database related
async function readerBadgeUpdate(conn) {

  // TODO: this should get count, setup text, and pass text to
  // extensionSetBadgeText. extensionSetBadgeText should not do
  // much more than set badge text to whatever text is given.

  extensionSetBadgeText(await readerDbCountUnreadEntries(conn));
}
