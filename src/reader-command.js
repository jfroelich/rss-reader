'use strict';

// import base/indexeddb.js
// import base/number.js
// import base/errors.js
// import poll/poll.js
// import favicon.js
// import reader-db.js
// import reader-storage.js

async function readerCommand(command, ...args) {
  switch(command) {
  case 'refreshicons': {
    let readerConn, iconConn;
    try {
      [readerConn, iconConn] = await Promise.all([readerDbOpen(),
        faviconDbOpen()]);
      await readerStorageRefreshFeedIcons(readerConn, iconConn);
    } finally {
      indexedDBClose(readerConn, iconConn);
    }
    break;
  }
  case 'archive': {
    let maxAgeMs, conn;
    try {
      conn = await readerDbOpen();
      await readerStorageArchiveEntries(conn, maxAgeMs, args);
    } finally {
      indexedDBClose(conn);
    }
    break;
  }
  case 'poll': {
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
    break;
  }
  case 'scanlost': {
    let conn;
    try {
      conn = await readerDbOpen();
      await readerStorageRemoveLostEntries(conn, args);
    } finally {
      indexedDBClose(conn);
    }
    break;
  }
  case 'scanorphans': {
    let conn;
    try {
      conn = await readerDbOpen();
      await readerStorageRemoveOrphans(conn, args);
    } finally {
      indexedDBClose(conn);
    }
    break;
  }
  case 'clearicons': {
    let conn;
    try {
      conn = await faviconDbOpen();
      await faviconDbClear(conn);
    } finally {
      indexedDBClose(conn);
    }
    break;
  }
  default:
    console.error('Unknown command', command);
    print_usage();
    break;
  }


  function print_usage() {
    console.debug('Commands:', [
      'refreshicons',
      'archive',
      'poll',
      'scanlost',
      'scanorphans',
      'clearicons'
    ]);
  }
}
