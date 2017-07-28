// See license.md
'use strict';

{ // Begin file block scope

async function commandPollFeeds() {
  const options = {};
  options.ignoreIdleState = true;
  options.ignoreModifiedCheck = true;
  options.ignoreRecencyCheck = true;
  options.verbose = true;
  await pollFeeds(options);
}

this.commandPollFeeds = commandPollFeeds;

async function pollFeeds(options) {
  options = initOptions(options);
  if(options.verbose) {
    console.log('Checking for new articles...');
  }

  if(!await canStartPoll(options)) {
    return;
  }

  let numEntriesAdded = 0;
  let iconDbName, iconDbVersion, connectTimeoutMillis;

  const readerConnPromise = openReaderDb();
  const iconConnPromise = openFaviconDb(iconDbName, iconDbVersion,
    connectTimeoutMillis, options.verbose);
  const connectionPromises = [readerConnPromise, iconConnPromise];
  let readerConn, iconConn;

  try {
    const connections = await Promise.all(connectionPromises);
    readerConn = connections[0];
    iconConn = connections[1];
    const feeds = await loadPollableFeeds(readerConn, options);
    numEntriesAdded = await processFeeds(readerConn, iconConn, feeds, options);
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
  if(options.verbose) {
    console.log('Polling completed');
  }
  return numEntriesAdded;
}

this.pollFeeds = pollFeeds;

function initOptions(options) {
  options = options || {};
  options.verbose = 'verbose' in options ? options.verbose : false;
  options.allowMetered = 'allowMetered' in options ? options.allowMetered :
    true;
  options.ignoreIdleState = 'ignoreIdleState' in options ?
    options.ignoreIdleState : false;
  options.ignoreRecencyCheck = 'ignoreRecencyCheck' in options ?
    options.ignoreRecencyCheck : false;
  options.ignoreModifiedCheck = 'ignoreModifiedCheck' in options ?
    options.ignoreModifiedCheck : false;
  options.idlePeriodSeconds = 'idlePeriodSeconds' in options ?
    options.idlePeriodSeconds : 30;
  options.recencyPeriodMillis = 'recencyPeriodMillis' in options ?
    options.recencyPeriodMillis : 5 * 60 * 1000;
  options.fetchFeedTimeoutMillis = 'fetchFeedTimeoutMillis' in options ?
    options.fetchFeedTimeoutMillis : 5000;
  options.fetchHTMLTimeoutMillis = 'fetchHTMLTimeoutMillis' in options ?
    options.fetchHTMLTimeoutMillis : 5000;
  options.fetchImageTimeoutMillis = 'fetchImageTimeoutMillis' in options ?
    options.fetchImageTimeoutMillis : 3000;
  return options;
}

async function canStartPoll(options) {
  if(isOffline()) {
    if(options.verbose) {
      console.warn('Polling canceled because offline');
    }
    return false;
  }

  if(!options.allowMeteredConnections && 'NO_POLL_METERED' in localStorage &&
    isMeteredConnection()) {
    if(options.verbose) {
      console.warn('Polling canceled because connection is metered');
    }
    return false;
  }

  if(!options.ignoreIdleState && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await queryIdleState(options.idlePeriodSeconds);
    if(state !== 'locked' && state !== 'idle') {
      if(options.verbose) {
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

async function loadPollableFeeds(readerConn, options) {
  const feeds = await loadAllFeedsFromDb(readerConn);
  if(options.ignoreRecencyCheck) {
    return feeds;
  }

  const outputFeeds = [];
  for(let feed of feeds) {
    if(isFeedPollEligible(feed, options)) {
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

function isFeedPollEligible(feed, options) {
  // If we do not know when the feed was fetched, then assume it is a new feed
  // that has never been fetched. In this case, consider the feed to be
  // eligible
  if(!feed.dateFetched) {
    return true;
  }

  // The amount of time that has elapsed, in milliseconds, from when the
  // feed was last polled.
  const elapsed = new Date() - feed.dateFetched;
  if(elapsed < options.recencyPeriodMillis) {
    // A feed has been polled too recently if not enough time has elasped from
    // the last time the feed was polled.
    if(options.verbose) {
      console.debug('Feed polled too recently', getFeedURLString(feed));
    }
    // In this case we do not want to poll the feed
    return false;
  } else {
    // Otherwise we do want to poll the feed
    return true;
  }
}

async function processFeeds(readerConn, iconConn, feeds, options) {
  const promises = [];
  for(let feed of feeds) {
    const promise = processFeedSilently(readerConn, iconConn, feed, options);
    promises.push(promise);
  }

  const resolutions = await Promise.all(promises);
  let totalEntriesAdded = 0;
  for(let numEntriesAdded of resolutions) {
    totalEntriesAdded += numEntriesAdded;
  }
  return totalEntriesAdded;
}

async function processFeedSilently(readerConn, iconConn, feed, options) {
  let numEntriesAdded = 0;
  try {
    numEntriesAdded = await processFeed(readerConn, iconConn, feed, options);
  } catch(error) {
    if(options.verbose) {
      console.warn(error);
    }
  }
  return numEntriesAdded;
}

// @throws {Error} any exception thrown by fetchFeed is rethrown
async function processFeed(readerConn, iconConn, localFeed, options) {

  if(typeof localFeed === 'undefined') {
    throw new TypeError('localFeed is undefined in processFeed params');
  }

  const urlString = getFeedURLString(localFeed);

  const fetchOptions = {};
  fetchOptions.verbose = options.verbose;
  fetchOptions.timeoutMillis = options.fetchFeedTimeoutMillis;
  const response = await fetchFeed(urlString, fetchOptions);

  // Before parsing, check if the feed was modified
  if(!options.ignoreModifiedCheck && localFeed.dateUpdated &&
    isFeedUnmodified(localFeed.dateLastModified, response.lastModifiedDate)) {
    if(options.verbose) {
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
    storableFeed, parseResult.entries, options);
  return numEntriesAdded;
}

async function processEntries(readerConn, iconConn, feed, entries, options) {
  entries = filterDuplicateEntries(entries);
  const promises = [];
  for(let entry of entries) {
    const promise = pollEntry(readerConn, iconConn, feed, entry, options);
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

} // End file block scope
