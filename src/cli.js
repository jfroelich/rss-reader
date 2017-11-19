// Command line interface module. This module does not export anything. Instead, it defines a
// variable in global scope (window). The definition occurs as an implicit side effect of importing
// the module.

import archiveEntries from "/src/archive-entries.js";
import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";
import {pollFeeds, PollFeedsContext} from "/src/poll-feeds.js";
import * as rdb from "/src/rdb.js";
import refreshFeedIcons from "/src/refresh-feed-icons.js";
import removeLostEntries from "/src/remove-lost-entries.js";
import removeOrphanedEntries from "/src/remove-orphaned-entries.js";
import {parseInt10} from "/src/string.js";

const cli = {};

cli.refreshIcons = async function() {
  const fic = new FaviconCache();
  let rConn;
  try {
    [rConn] = await Promise.all([rdb.open(), fic.open()]);
    await refreshFeedIcons(rConn, fic);
  } finally {
    fic.close();
    rdb.close(rConn);
  }
};

cli.archiveEntries = async function(limit) {
  let maxAgeMs, conn;
  try {
    conn = await rdb.open();
    await archiveEntries(conn, maxAgeMs, limit);
  } finally {
    rdb.close(conn);
  }
};

cli.pollFeeds = async function() {
  const fic = new FaviconCache();
  const pfc = new PollFeedsContext();
  pfc.iconCache = fic;
  pfc.allowMeteredConnections = true;
  pfc.ignoreIdleState = true;
  pfc.ignoreRecencyCheck = true;
  pfc.ignoreModifiedCheck = true;
  try {
    [pfc.readerConn] = await Promise.all([rdb.open(), fic.open()]);
    await pollFeeds(pfc);
  } finally {
    fic.close();
    rdb.close(pfc.readerConn);
  }
};

cli.removeListEntries = async function() {
  let conn;
  try {
    conn = await rdb.open();
    await removeLostEntries(conn, args);
  } finally {
    rdb.close(conn);
  }
};

cli.removeOrphanedEntries = async function() {
  let conn;
  try {
    conn = await rdb.open();
    await removeOrphanedEntries(conn, args);
  } finally {
    rdb.close(conn);
  }
};

cli.clearFavicons = async function() {
  const fic = new FaviconCache();
  try {
    await fic.open();
    await fic.clear();
  } finally {
    fic.close();
  }
};

cli.lookupFavicon = async function(url, timeout, cacheless = true) {
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
};

// Modules are basically wrapped in a promise. To enable variables to be accessible from the
// console, which can only see global variables, and not "exported" variables from modules, the
// values must be defined "really" globally. Right now using window seems to work. This is not a
// recommended practice, but I think this is an exception because calling this from the console is
// the entire point of this module.
if(window) {
  window.cli = cli;
} else {
  console.warn('cli unavailable (no window)');
}
