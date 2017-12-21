import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import FeedStore from "/src/feed-store/feed-store.js";
import PollFeeds from "/src/jobs/poll/poll-feeds.js";
import removeOrphanedEntries from "/src/jobs/remove-orphaned-entries.js";
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
    await fs.refreshFeedIcons(fc);
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
    await store.archiveEntries(maxAgeMs, limit);
  } finally {
    store.close();
  }
};

cli.pollFeeds = async function() {
  const poll = new PollFeeds();
  poll.init();
  poll.ignoreRecencyCheck = true;
  poll.ignoreModifiedCheck = true;

  try {
    await poll.open();
    await poll.pollFeeds();
  } finally {
    poll.close();
  }
};

cli.removeLostEntries = async function(limit) {
  const fs = new FeedStore();
  try {
    await fs.open();
    await fs.removeLostEntries(limit);
  } finally {
    fs.close();
  }
};

cli.removeOrphanedEntries = async function(limit) {
  const fs = new FeedStore();
  try {
    await fs.open();
    await removeOrphanedEntries(fs, limit);
  } finally {
    fs.close();
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
