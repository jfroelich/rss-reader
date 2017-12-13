import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import FeedStore from "/src/feed-store/feed-store.js";
import archiveEntries from "/src/jobs/archive-entries/archive-entries.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import pollFeeds from "/src/jobs/poll/poll-feeds.js";
import refreshFeedIcons from "/src/jobs/refresh-feed-icons.js";
import removeLostEntries from "/src/jobs/remove-lost-entries.js";
import removeOrphanedEntries from "/src/jobs/remove-orphaned-entries.js";
import openReaderDb from "/src/reader-db/open.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import parseInt10 from "/src/utils/parse-int-10.js";

// Command line interface module. This module does not export anything. Instead, it defines a
// variable in global scope (window). The definition occurs as an implicit side effect of importing
// the module.
const cli = {};

cli.refreshIcons = async function() {
  const fs = new FeedStore();
  const fc = new FaviconCache();
  const promises = [fs.open(), fc.open()];

  try {
    await Promise.all(promises);
    await refreshFeedIcons(fs, fc);
  } finally {
    fs.close();
    fc.close();
  }
};

cli.archiveEntries = async function(limit) {
  const store = new FeedStore();
  let maxAgeMs;
  try {
    await store.open();
    await archiveEntries(store, maxAgeMs, limit);
  } finally {
    store.close();
  }
};

cli.pollFeeds = async function() {
  const pc = new PollContext();
  pc.iconCache = new FaviconCache();
  pc.allowMeteredConnections = true;
  pc.ignoreRecencyCheck = true;
  pc.ignoreModifiedCheck = true;

  try {
    await pc.open();
    await pollFeeds.call(pc);
  } finally {
    pc.close();
  }
};

cli.removeListEntries = async function() {
  let conn;
  try {
    conn = await openReaderDb();
    await removeLostEntries(conn, args);
  } finally {
    IndexedDbUtils.close(conn);
  }
};

cli.removeOrphanedEntries = async function() {
  let conn;
  try {
    conn = await openReaderDb();
    await removeOrphanedEntries(conn, args);
  } finally {
    IndexedDbUtils.close(conn);
  }
};

cli.clearFavicons = async function() {
  const fc = new FaviconCache();
  try {
    await fc.open();
    await fc.clear();
  } finally {
    fc.close();
  }
};

cli.compactFavicons = async function(limit) {
  const fc = new FaviconCache();
  let maxAgeMs;
  try {
    await fc.open();
    await fc.compact(maxAgeMs, limit);
  } finally {
    fc.close();
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
