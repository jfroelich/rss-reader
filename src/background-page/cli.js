import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import FeedStore from "/src/feed-store/feed-store.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";

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
  const poll = new FeedPoll();
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
  const store = new FeedStore();
  try {
    await store.open();
    await store.removeLostEntries(limit);
  } finally {
    store.close();
  }
};

cli.removeOrphanedEntries = async function(limit) {
  const store = new FeedStore();
  try {
    await store.open();
    await store.removeOrphanedEntries(limit);
  } finally {
    store.close();
  }
};

cli.clearFavicons = async function() {
  const cache = new FaviconCache();
  try {
    await cache.open();
    await cache.clear();
  } finally {
    cache.close();
  }
};

cli.compactFavicons = async function(limit) {
  const cache = new FaviconCache();
  let maxAgeMs;
  try {
    await cache.open();
    await cache.compact(maxAgeMs, limit);
  } finally {
    cache.close();
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

window.cli = cli;
