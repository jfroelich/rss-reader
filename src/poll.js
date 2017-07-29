// See license.md
'use strict';

{ // Begin file block scope

const POLL_FEEDS_FLAGS = {};
POLL_FEEDS_FLAGS.VERBOSE = 1; // 1
POLL_FEEDS_FLAGS.ALLOW_METERED_CONNECTIONS = 2; // 10
POLL_FEEDS_FLAGS.IGNORE_RECENCY_CHECK = 4; // 100
POLL_FEEDS_FLAGS.IGNORE_IDLE_STATE = 8; // 1000
POLL_FEEDS_FLAGS.IGNORE_MODIFIED_CHECK = 16; // 10000

async function commandPollFeeds() {
  const flags = POLL_FEEDS_FLAGS.ALLOW_METERED_CONNECTIONS |
    POLL_FEEDS_FLAGS.IGNORE_IDLE_STATE | POLL_FEEDS_FLAGS.IGNORE_RECENCY_CHECK |
    POLL_FEEDS_FLAGS.IGNORE_MODIFIED_CHECK | POLL_FEEDS_FLAGS.VERBOSE;
  let recencyPeriodMillis, idlePeriodSeconds, fetchFeedTimeoutMillis,
    fetchHTMLTimeoutMillis, fetchImageTimeoutMillis;
  await pollFeeds(idlePeriodSeconds, recencyPeriodMillis,
    fetchFeedTimeoutMillis, fetchHTMLTimeoutMillis, fetchImageTimeoutMillis,
    flags);
}

async function pollFeeds(idlePeriodSeconds, recencyPeriodMillis,
  fetchFeedTimeoutMillis, fetchHTMLTimeoutMillis, fetchImageTimeoutMillis,
  flags) {
  if(typeof idlePeriodSeconds === 'undefined') {
    idlePeriodSeconds = 30;
  }
  if(typeof recencyPeriodMillis === 'undefined') {
    recencyPeriodMillis = 5 * 60 * 1000;
  }
  if(typeof fetchFeedTimeoutMillis === 'undefined') {
    fetchFeedTimeoutMillis = 5000;
  }
  if(typeof fetchHTMLTimeoutMillis === 'undefined') {
    fetchHTMLTimeoutMillis = 5000;
  }
  if(typeof fetchImageTimeoutMillis === 'undefined') {
    fetchImageTimeoutMillis = 3000;
  }
  if(typeof flags === 'undefined') {
    flags = 0;
  }

  const allowMeteredConnections = flags &
    POLL_FEEDS_FLAGS.ALLOW_METERED_CONNECTIONS;
  const ignoreIdleState = flags & POLL_FEEDS_FLAGS.IGNORE_IDLE_STATE;
  const ignoreRecencyCheck = flags & POLL_FEEDS_FLAGS.IGNORE_RECENCY_CHECK;
  const ignoreModifiedCheck = flags & POLL_FEEDS_FLAGS.IGNORE_MODIFIED_CHECK;
  const verbose = flags & POLL_FEEDS_FLAGS.VERBOSE;

  if(verbose) {
    console.log('Checking for new articles...');
  }

  if(!await canStartPoll(allowMeteredConnections, ignoreIdleState,
    idlePeriodSeconds, verbose)) {
    return;
  }

  let numEntriesAdded = 0;
  // TODO: these 3 should all probably be parameters to pollFeeds
  let iconDbName, iconDbVersion, connectTimeoutMillis;

  const readerConnPromise = openReaderDb();
  const iconConnPromise = openFaviconDb(iconDbName, iconDbVersion,
    connectTimeoutMillis, verbose);
  const connectionPromises = [readerConnPromise, iconConnPromise];
  let readerConn, iconConn;

  try {
    const connections = await Promise.all(connectionPromises);
    readerConn = connections[0];
    iconConn = connections[1];
    const feeds = await loadPollableFeeds(readerConn,
      ignoreRecencyCheck, recencyPeriodMillis, verbose);
    numEntriesAdded = await processFeeds(readerConn, iconConn, feeds,
      ignoreModifiedCheck, fetchFeedTimeoutMillis, fetchHTMLTimeoutMillis,
      fetchImageTimeoutMillis, verbose);
    if(numEntriesAdded) {
      await updateBadgeText(readerConn);
    }
  } finally {
    if(readerConn) {
      readerConn.close();
    }
    if(iconConn) {
      iconConn.close();
    }
  }

  if(numEntriesAdded) {
    showPollNotification(numEntriesAdded);
  }
  broadcastCompletedMessage(numEntriesAdded);
  if(verbose) {
    console.log('Polling completed');
  }
  return numEntriesAdded;
}

async function canStartPoll(allowMeteredConnections, ignoreIdleState,
  idlePeriodSeconds, verbose) {

  if(isOffline()) {
    if(verbose) {
      console.warn('Polling canceled because offline');
    }
    return false;
  }

  if(!allowMeteredConnections && 'NO_POLL_METERED' in localStorage &&
    isMeteredConnection()) {
    if(verbose) {
      console.warn('Polling canceled because connection is metered');
    }
    return false;
  }

  if(!ignoreIdleState && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await queryIdleState(idlePeriodSeconds);
    if(state !== 'locked' && state !== 'idle') {
      if(verbose) {
        console.warn('Polling canceled because machine not idle');
      }
      return false;
    }
  }

  return true;
}

function loadAllFeedsFromDb(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadPollableFeeds(readerConn, ignoreRecencyCheck,
  recencyPeriodMillis, verbose) {
  const feeds = await loadAllFeedsFromDb(readerConn);
  if(ignoreRecencyCheck) {
    return feeds;
  }

  const outputFeeds = [];
  for(let feed of feeds) {
    if(isFeedPollEligible(feed, recencyPeriodMillis, verbose)) {
      outputFeeds.push(feed);
    }
  }
  return outputFeeds;
}

function showPollNotification(numEntriesAdded) {
  const title = 'Added articles';
  const message = `Added ${numEntriesAdded} articles`;
  showNotification(title, message);
}

function isFeedPollEligible(feed, recencyPeriodMillis, verbose) {
  // If we do not know when the feed was fetched, then assume it is a new feed
  // that has never been fetched. In this case, consider the feed to be
  // eligible
  if(!feed.dateFetched) {
    return true;
  }

  // The amount of time that has elapsed, in milliseconds, from when the
  // feed was last polled.
  const elapsed = new Date() - feed.dateFetched;
  if(elapsed < recencyPeriodMillis) {
    // A feed has been polled too recently if not enough time has elasped from
    // the last time the feed was polled.
    if(verbose) {
      console.debug('Feed polled too recently', getFeedURLString(feed));
    }
    // In this case we do not want to poll the feed
    return false;
  } else {
    // Otherwise we do want to poll the feed
    return true;
  }
}

async function processFeeds(readerConn, iconConn, feeds, ignoreModifiedCheck,
  fetchFeedTimeoutMillis, fetchHTMLTimeoutMillis, fetchImageTimeoutMillis,
  verbose) {
  const promises = [];
  for(let feed of feeds) {
    const promise = processFeedSilently(readerConn, iconConn, feed,
      fetchFeedTimeoutMillis, ignoreModifiedCheck, fetchHTMLTimeoutMillis,
      fetchImageTimeoutMillis, verbose);
    promises.push(promise);
  }

  const resolutions = await Promise.all(promises);
  let totalEntriesAdded = 0;
  for(let numEntriesAdded of resolutions) {
    totalEntriesAdded += numEntriesAdded;
  }
  return totalEntriesAdded;
}

async function processFeedSilently(readerConn, iconConn, feed,
  fetchFeedTimeoutMillis, ignoreModifiedCheck, fetchHTMLTimeoutMillis,
  fetchImageTimeoutMillis, verbose) {
  let numEntriesAdded = 0;
  try {
    numEntriesAdded = await processFeed(readerConn, iconConn, feed,
      fetchFeedTimeoutMillis, ignoreModifiedCheck, fetchHTMLTimeoutMillis,
      fetchImageTimeoutMillis, verbose);
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
  }
  return numEntriesAdded;
}

// @throws {Error} any exception thrown by fetchFeed is rethrown
async function processFeed(readerConn, iconConn, localFeed,
  fetchFeedTimeoutMillis, ignoreModifiedCheck, fetchHTMLTimeoutMillis,
  fetchImageTimeoutMillis, verbose) {

  if(typeof localFeed === 'undefined') {
    throw new TypeError('localFeed is undefined in processFeed params');
  }

  const urlString = getFeedURLString(localFeed);

  const timeoutMillis = fetchFeedTimeoutMillis;
  const acceptHTML = true;

  const response = await fetchFeed(urlString, timeoutMillis, acceptHTML);

  // Before parsing, check if the feed was modified
  if(!ignoreModifiedCheck && localFeed.dateUpdated &&
    isFeedUnmodified(localFeed.dateLastModified, response.lastModifiedDate)) {
    if(verbose) {
      console.debug('Skipping unmodified feed', urlString,
        localFeed.dateLastModified, response.lastModifiedDate);
    }
    return 0;
  }

  const parseResult = parseFetchedFeed(response);
  const mergedFeed = mergeFeeds(localFeed, parseResult.feed);
  let storableFeed = sanitizeFeed(mergedFeed);
  storableFeed = filterEmptyProperties(storableFeed);
  storableFeed.dateUpdated = new Date();
  await putFeedInDb(readerConn, storableFeed);

  const numEntriesAdded = await processEntries(readerConn, iconConn,
    storableFeed, parseResult.entries, fetchHTMLTimeoutMillis,
    fetchImageTimeoutMillis, verbose);
  return numEntriesAdded;
}

async function processEntries(readerConn, iconConn, feed, entries,
  fetchHTMLTimeoutMillis, fetchImageTimeoutMillis, verbose) {
  entries = filterDuplicateEntries(entries);
  const promises = [];
  for(let entry of entries) {
    const promise = pollEntry(readerConn, iconConn, feed, entry,
      fetchHTMLTimeoutMillis, fetchImageTimeoutMillis, verbose);
    promises.push(promise);
  }

  const resolutions = await Promise.all(promises);
  let numEntriesAdded = 0;
  for(let resolution of resolutions) {
    if(resolution) {
      numEntriesAdded++;
    }
  }
  return numEntriesAdded;
}

function isFeedUnmodified(localDateModified, remoteDateModified) {
  return localDateModified && remoteDateModified &&
    localDateModified.getTime() === remoteDateModified.getTime();
}

function filterDuplicateEntries(entries) {
  // TODO: use a Set?
  const distinctEntries = [];
  const seenURLs = [];

  for(let entry of entries) {
    let isPreviouslySeenURL = false;
    for(let urlString of entry.urls) {
      if(seenURLs.includes(urlString)) {
        isPreviouslySeenURL = true;
        break;
      }
    }

    if(!isPreviouslySeenURL) {
      distinctEntries.push(entry);
      seenURLs.push(...entry.urls);
    }
  }

  return distinctEntries;
}

// Adds or overwrites a feed in storage. Resolves with the new feed id if add.
// There are no side effects other than the database modification.
// @param conn {IDBDatabase} an open database connection
// @param feed {Object} the feed object to add
function putFeedInDb(conn, feed) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => {
      const feedId = request.result;
      resolve(feedId);
    };
    request.onerror = () => reject(request.error);
  });
}

function queryIdleState(idlePeriodSeconds) {
  return new Promise(function(resolve) {
    chrome.idle.queryState(idlePeriodSeconds, resolve);
  });
}

// experimental
function isMeteredConnection() {
  return navigator.connection && navigator.connection.metered;
}

function isOffline() {
  return 'onLine' in navigator && !navigator.onLine;
}

function broadcastCompletedMessage(numEntriesAdded) {
  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();
}

this.commandPollFeeds = commandPollFeeds;
this.pollFeeds = pollFeeds;
this.POLL_FEEDS_FLAGS = POLL_FEEDS_FLAGS;

} // End file block scope
