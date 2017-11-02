'use strict';

// import base/indexeddb.js
// import base/number.js
// import base/errors.js
// import poll/poll.js
// import favicon.js
// import reader-db.js
// import reader-storage.js

async function cliRefreshFeedIcons() {
  let readerConn, iconConn, status;
  try {
    [readerConn, iconConn] = await Promise.all([readerDbOpen(),
      faviconDbOpen()]);
    status = await readerStorageRefreshFeedIcons(readerConn, iconConn);
  } finally {
    indexedDBClose(readerConn, iconConn);
  }

  return status;
}

async function cliArchiveEntries(limit) {
  console.log('cliArchiveEntries start');
  let maxAgeMs, conn, status;
  limit = limit || 10;
  try {
    conn = await readerDbOpen();
    status = await readerStorageArchiveEntries(conn, maxAgeMs, limit);
  } finally {
    indexedDBClose(conn);
  }
  console.log('cliArchiveEntries end');
  return status;
}

async function cliPollFeeds() {
  console.log('cliPollFeeds start');
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
  console.log('cliPollFeeds end');
  return RDR_OK;
}

async function cliScanLost(limit) {
  console.log('cliScanLost start');
  if(!numberIsPositiveInteger(limit) || limit < 1) {
    throw new TypeError('limit must be > 0');
  }

  let conn, status;
  try {
    conn = await readerDbOpen();
    status = await readerStorageRemoveLostEntries(conn, limit);
  } finally {
    indexedDBClose(conn);
  }

  return status;
}

async function cliScanOrphans(limit) {
  console.log('cliScanOrphans start');
  if(!numberIsPositiveInteger(limit) || limit < 1) {
    throw new TypeError('limit must be > 0');
  }

  let conn, status;
  try {
    conn = await readerDbOpen();
    status = await readerStorageRemoveOrphans(conn, limit);
  } finally {
    indexedDBClose(conn);
  }

  return status;
}

async function cliClearFavicons() {
  console.log('cliClearFavicons start');
  let conn;
  try {
    conn = await faviconDbOpen();
    await faviconDbClear(conn);
  } finally {
    indexedDBClose(conn);
  }

  return RDR_OK;
}
