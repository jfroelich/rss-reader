// Command line interface module
// This module does not export anything. Instead, it defines a function in global scope (window).
// The definition occurs as an implicit side effect of importing the module.
//
// Modules are basically wrapped in a promise. To enable variables to be accessible from
// the console, which can only see global variables, and not exported variables
// from modules, the values must be defined "really" globally. Right now using window seems
// to work. This is not a recommended practice, but I think this is an exception, because
// it is the entire point of this module, to be callable from the console

import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";
import {pollFeeds, PollFeedsContext} from "/src/poll-feeds.js";
import * as rdb from "/src/rdb.js";
import {
  readerStorageArchiveEntries,
  readerStorageRemoveLostEntries,
  readerStorageRemoveOrphans
} from "/src/reader-storage.js";
import refreshFeedIcons from "/src/refresh-feed-icons.js";
import {parseInt10} from "/src/string.js";


// TODO: maybe break apart back into functions and export under a cli namespace object

async function execCommand(command, ...args) {
  switch(command) {
  case 'refreshicons': {
    const fic = new FaviconCache();
    let rConn, _;
    try {
      [rConn, _] = await Promise.all([rdb.open(), fic.open()]);
      await refreshFeedIcons(rConn, fic.conn);
    } finally {
      fic.close();
      rdb.close(rConn);
    }
    break;
  }
  case 'archive': {
    let maxAgeMs, conn, limit;
    if(args && args.length) {
      limit = args[0];
    }

    try {
      conn = await rdb.open();
      await readerStorageArchiveEntries(conn, maxAgeMs, limit);
    } finally {
      rdb.close(conn);
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
      [pfc.readerConn, _] = await Promise.all([rdb.open(), fic.open()]);
      await pollFeeds(pfc);
    } finally {
      fic.close();
      rdb.close(pfc.readerConn);
    }
    break;
  }
  case 'scanlost': {
    let conn;
    try {
      conn = await rdb.open();
      await readerStorageRemoveLostEntries(conn, args);
    } finally {
      rdb.close(conn);
    }
    break;
  }
  case 'scanorphans': {
    let conn;
    try {
      conn = await rdb.open();
      await readerStorageRemoveOrphans(conn, args);
    } finally {
      rdb.close(conn);
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

// TODO: reorder alphabetically

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


if(window) {
  window.execCommand = execCommand;
}
