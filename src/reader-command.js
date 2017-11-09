'use strict';

// import net/url-utils.js
// import poll/poll.js
// import favicon.js
// import rbl.js
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
      closeDB(readerConn, iconConn);
    }
    break;
  }
  case 'archive': {
    let maxAgeMs, conn, limit;

    if(args && args.length) {
      limit = args[0];
    }

    try {
      conn = await readerDbOpen();
      await readerStorageArchiveEntries(conn, maxAgeMs, limit);
    } finally {
      closeDB(conn);
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
      closeDB(pfc.readerConn, pfc.iconConn);
    }
    break;
  }
  case 'scanlost': {
    let conn;
    try {
      conn = await readerDbOpen();
      await readerStorageRemoveLostEntries(conn, args);
    } finally {
      closeDB(conn);
    }
    break;
  }
  case 'scanorphans': {
    let conn;
    try {
      conn = await readerDbOpen();
      await readerStorageRemoveOrphans(conn, args);
    } finally {
      closeDB(conn);
    }
    break;
  }
  case 'clearicons': {
    let conn;
    try {
      conn = await faviconDbOpen();
      await faviconDbClear(conn);
    } finally {
      closeDB(conn);
    }
    break;
  }
  case 'iconlookup': {
    let url, timeout, cacheless = true;
    if(args && args.length) {
      url = args[0];
      if(args.length > 1) {
        timeout = parseInt10(args[1]);
        if(args.length > 2) {
          cacheless = args[2];
        }
      }
    }

    const query = new FaviconQuery();
    query.url = new URL(url);
    query.fetchHTMLTimeoutMs = timeout;
    try {
      if(!cacheless) {
        query.conn = await faviconDbOpen();
      }

      return await faviconLookup(query);
    } finally {
      closeDB(query.conn);
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
      'clearicons',
      'iconlookup'
    ]);
  }
}
