'use strict';

// import poll/poll.js
// import favicon-cache.js
// import favicon-lookup.js
// import rbl.js
// import reader-db.js
// import reader-storage.js
// import url.js

async function readerCommand(command, ...args) {
  switch(command) {
  case 'refreshicons': {

    const fic = new FaviconCache();
    let readerConn, _;
    try {
      [readerConn, _] = await Promise.all([readerDbOpen(), fic.open()]);
      await readerStorageRefreshFeedIcons(readerConn, fic.conn);
    } finally {
      fic.close();
      closeDB(readerConn);
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

    const fic = new FaviconCache();

    const pfc = new PollFeedsContext();
    pfc.iconCache = fic;
    pfc.allowMeteredConnections = true;
    pfc.ignoreIdleState = true;
    pfc.ignoreRecencyCheck = true;
    pfc.ignoreModifiedCheck = true;

    let _;

    try {
      [pfc.readerConn, _] = await Promise.all([readerDbOpen(), fic.open()]);
      await pollFeeds(pfc);
    } finally {
      fic.close();
      closeDB(pfc.readerConn);
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
    const fic = new FaviconCache();
    try {
      await fic.open();
      await fic.clear();
    } finally {
      fic.close();
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

    const query = new FaviconLookup();
    query.cache = new FaviconCache();
    query.fetchHTMLTimeoutMs = timeout;

    try {
      if(!cacheless) {
        await query.cache.open();
      }

      return await query.lookup(new URL(url));
    } finally {
      if(!cacheless) {
        query.cache.close();
      }
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
