// Command line interface

import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";
import {closeDB} from "/src/idb.js";
import {pollFeeds, PollFeedsContext} from "/src/poll-feeds.js";
import {readerDbOpen} from "/src/reader-db.js";
import {
  readerStorageArchiveEntries,
  readerStorageRefreshFeedIcons,
  readerStorageRemoveLostEntries,
  readerStorageRemoveOrphans
} from "/src/reader-storage.js";
import {parseInt10} from "/src/string.js";

export async function readerCommand(command, ...args) {
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
    printUsage();
    break;
  }
}

// TODO: reorder

function printUsage() {
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

// Modules are basically wrapped in a promise. To enable variables to be accessible from
// the console, which can only see global variables, and apparently not exported variables
// from modules, the values must be defined "really" globally. Right now using window seems
// to work. This is not a recommended practice, but I think this is an exception, because
// it is the entire point of this module, to be callable from the console
// TODO: maybe it should module importer's responsibility to do this
if(window) {
  window.readerCommand = readerCommand;
}
