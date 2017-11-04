'use strict';

// import base/indexeddb.js
// import base/number.js
// import base/errors.js
// import poll/poll.js
// import favicon.js
// import reader-db.js
// import reader-storage.js

async function cliRefreshFeedIcons() {
  let readerConn, iconConn;
  try {
    [readerConn, iconConn] = await Promise.all([readerDbOpen(),
      faviconDbOpen()]);
    await readerStorageRefreshFeedIcons(readerConn, iconConn);
  } finally {
    indexedDBClose(readerConn, iconConn);
  }
}

async function cliArchiveEntries(limit) {
  let maxAgeMs, conn;
  limit = limit || 10;
  try {
    conn = await readerDbOpen();
    await readerStorageArchiveEntries(conn, maxAgeMs, limit);
  } finally {
    indexedDBClose(conn);
  }
}

async function cliPollFeeds() {
  const pfc = new PollFeedsContext();
  pfc.allowMeteredConnections = true;
  pfc.ignoreIdleState = true;
  pfc.ignoreRecencyCheck = true;
  pfc.ignoreModifiedCheck = true;

  try {
    [pfc.readerConn, pfc.iconConn] = await Promise.all([readerDbOpen(),
      faviconDbOpen()]);
    await pollFeeds(pfc);
  } finally {
    indexedDBClose(pfc.readerConn, pfc.iconConn);
  }

  // TODO: once pollFeeds returns status, use that as return value
  return RDR_OK;
}

async function cliScanLost(limit) {
  if(typeof limit !== 'undefined') {
    // This check is not an assertion because this is a user-specified parameter
    // that is not indicative of a violation of an invariant condition.
    if(!numberIsPositiveInteger(limit) || limit < 1) {
      // This is not worthy of an exception because it is a top level console
      // call, so instead directly inform the caller in the console and exit.
      console.warn('Scan canceled. Limit must be integer greater than 0.');
      return;
    }
  }

  let conn;
  try {
    conn = await readerDbOpen();
    await readerStorageRemoveLostEntries(conn, limit);
  } finally {
    indexedDBClose(conn);
  }
}

async function cliScanOrphans(limit) {
  if(typeof limit !== 'undefined') {
    if(!numberIsPositiveInteger(limit) || limit < 1) {
      console.warn('scan canceled, invalid limit');
      return;
    }
  }

  let conn;
  try {
    conn = await readerDbOpen();
    await readerStorageRemoveOrphans(conn, limit);
  } finally {
    indexedDBClose(conn);
  }
}

async function cliClearFavicons() {
  let conn;
  try {
    conn = await faviconDbOpen();
    await faviconDbClear(conn);
  } finally {
    indexedDBClose(conn);
  }
  return RDR_OK;
}
