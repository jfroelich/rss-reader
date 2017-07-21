// See license.md

'use strict';

async function commandPollFeeds() {
  const options = {};
  options.ignoreIdleState = true;
  options.ignoreModifiedCheck = true;
  options.ignoreRecencyCheck = true;
  options.verbose = true;
  await pollFeeds(options);
}

{ // Begin file block scope

async function pollFeeds(options) {

  options = initOptions(options);
  if(options.verbose) {
    console.log('Checking for new articles...');
  }

  const shouldStartPoll = await checkPollStartingConditions(options);
  if(!shouldStartPoll) {
    return;
  }

  let numEntriesAdded = 0;
  const connectionPromises = [dbConnect(), favicon.connect()];
  let readerConn, iconConn;

  try {
    const connections = await Promise.all(connectionPromises);
    readerConn = connections[0];
    iconConn = connections[1];

    const feeds = await loadPollableFeeds(readerConn, options);
    numEntriesAdded = processFeeds(readerConn, iconConn, feeds, options);
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

  showPollNotification(numEntriesAdded);
  broadcastCompletedMessage();
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
  options.skipRecencyCheck = 'skipRecencyCheck' in options ?
    options.skipRecencyCheck : false;
  options.skipModifiedCheck = 'skipModifiedCheck' in options ?
    options.skipModifiedCheck : false;
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

async function checkPollStartingConditions(options) {
  if(isOffline()) {
    if(options.verbose) {
      console.warn('Polling canceled because offline');
    }
    return false;
  }

  if(!options.allowMeteredConnections && 'NO_POLL_METERED' in localStorage &&
    isMeteredConnection()) {
    if(options.verbose) {
      console.warn('Polling canceled due to metered connection');
    }
    return false;
  }

  if(!options.ignoreIdleState && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await queryIdleState(options.idlePeriodSeconds);
    if(state !== 'locked' && state !== 'idle') {
      if(options.verbose) {
        console.warn('Polling canceled due to idle requirement');
      }
      return false;
    }
  }

  return true;
}

async function loadPollableFeeds(readerConn, options) {

  const loadAllFeedsFromDb = function(conn) {
    return new Promise((resolve, reject) => {
      const tx = conn.transaction('feed');
      const store = tx.objectStore('feed');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const allFeeds = await loadAllFeedsFromDb(readerConn);
  if(options.skipRecencyCheck) {
    return allFeeds;
  }

  const outputFeeds = new Array(allFeeds.length);
  for(let feed of allFeeds) {
    if(isFeedPollEligible(feed, options)) {
      outputFeeds.push(feed);
    }
  }

  return outputFeeds;
}

function showPollNotification(numEntriesAdded) {
  if(numEntriesAdded) {
    const title = 'Added articles';
    const message = `Added ${numEntriesAdded} articles`;
    showNotification(title, message);
  }
}

// Return true if the feed was polled recently.
// Return false is the feed was not polled recently.
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

// Concurrently process feeds
async function processFeeds(readerConn, iconConn, feeds, options) {
  const promises = new Array(feeds.length);
  for(let feed of feeds) {
    // Do not await the promise here, to allow for concurrency. This merely
    // fires off requests for each feed to be eventually processed.
    const promise = processFeedSilently(readerConn, iconConn, feed, options);
    promises.push(promise);
  }

  // Wait for all feeds processing to finish
  const resolutions = await Promise.all(promises);

  let totalEntriesAdded = 0;
  for(let resolution of resolutions) {
    totalEntriesAdded += resolution;
  }
  return totalEntriesAdded;
}

// Suppresses processFeed exceptions
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

// TODO: the date the remote file has been modified can be gathered prior to
// the feed being parsed. This means the modified check can happen before
// parsing. This means that there is the potential of reducing the number of
// operations performed. This means I properly should break apart fetch
// feed into fetch feed xml and parse feed and post fetch feed processing
// @throws {Error} any exception thrown by fetchFeed
async function processFeed(readerConn, iconConn, localFeed, options) {
  const urlString = getFeedURLString(localFeed);
  const fetchResult = await fetchFeed(urlString,
    options.fetchFeedTimeoutMillis);
  const remoteFeed = fetchResult.feed;

  if(!options.skipModifiedCheck && localFeed.dateUpdated &&
    isFeedUnmodified(localFeed.dateLastModified, remoteFeed.dateLastModified)) {
    if(options.verbose) {
      console.debug('Skipping unmodified feed', urlString,
        localFeed.dateLastModified, remoteFeed.dateLastModified);
    }
    return 0;
  }

  const mergedFeed = mergeFeeds(localFeed, remoteFeed);
  let storableFeed = sanitizeFeed(mergedFeed);
  storableFeed = filterEmptyProperties(storableFeed);
  storableFeed.dateUpdated = new Date();
  await putFeedInDb(readerConn, storableFeed);

  const numEntriesAdded = await processEntries(readerConn, iconConn,
    storableFeed, fetchResult.entries, options);
  return numEntriesAdded;
}

async function processEntries(readerConn, iconConn, feed, entries, options) {
  entries = filterDuplicateEntries(entries);
  const promises = new Array(entries.length);
  for(let entry of entries) {
    // Fire off concurrently without waiting
    const promise = processEntry(readerConn, iconConn, storableFeed, entry,
      options);
    promises.push(promise);
  }

  // This fails fast because processEntry may throw
  const resolutions = await Promise.all(promises);

  let numEntriesAdded = 0;
  for(let resolution of resolutions) {
    if(resolution) {
      numEntriesAdded++;
    }
  }
  return numEntriesAdded;
}

// Resolve with true if entry was added, false if not added
// TODO: favicon lookup should be deferred until after fetch to avoid
// lookup of intermediate urls when possible
// TODO: use helper functions to reduce function size
async function processEntry(readerConn, iconConn, feed, entry,
  options) {

  entry.feed = feed.id;
  entry.feedTitle = feed.title;

  // Validate. Cannot assume remote entry is valid.
  if(!entry.urls || !entry.urls.length) {
    return false;
  }

  // Validate. Cannot assume remote entry is valid.
  if(!isEntryURLValid(entry)) {
    return false;
  }

  // First try and rewrite the url
  const didAppendRewrittenURL = rewriteEntryURL(entry);

  // Check if the entry should be ignored based on its url
  if(shouldExcludeEntry(entry)) {
    return false;
  }

  // Check if the initial url already exists in the database
  const originalURLString = entry.urls[0];
  if(await entryStore.containsURL(originalURLString)) {
    return false;
  }

  // Check if the rewritten url already exists in the database
  if(didAppendRewrittenURL) {
    const rewrittenURLString = getEntryURLString(entry);
    const isExistingRewrittenURL = await findEntryByURLInDb(readerConn,
      rewrittenURLString);
    if(isExistingRewrittenURL) {
      return false;
    }
  }

  await setEntryIcon(entry, iconConn, feed.faviconURLString);

  // Fetch the entry's full text
  // TODO: a minor optimization. If I break apart fetching html text and parsing
  // into a DOM, then the redirect exists check could happen before parsing
  // into a DOM, saving processing
  // TODO: avoid destructuring, use explicit assignment
  // TODO: make this into a helper function?

  const fetchURLString = getEntryURLString(entry);
  let documentObject, responseURLString;
  try {
    ({documentObject, responseURLString} = await fetchHTML(
      fetchURLString, fetchHTMLTimeoutMillis));
  } catch(error) {
    if(options.verbose) {
      logObject.warn(error);
    }

    // If there was a problem fetching, then we still want to store the content
    // as is from within the feed's xml.
    prepareLocalEntry(entry);
    const storedEntry = await addEntry(entry);
    return storedEntry;
  }

  const didRedirect = didRedirect(entry.urls, responseURLString);
  if(didRedirect) {
    if(await findEntryByURLInDb(readerConn, responseURLString)) {
      return false;
    }
    addEntryURLString(entry, responseURLString);
  }

  prepareEntryFullText(entry, documentObject, options);
  await addEntry(entry);
  return true;
}

// Resolves with a boolean indicating whether an entry with the given url
// was found in storage
// @param url {String}
function findEntryByURLInDb(conn, urlString) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

function prepareEntryFullText(entry, documentObject, options) {
  transformLazyImages(documentObject);

  // Must happen after lazy image transform, otherwise lazy images filtered
  scrubby.filterSourcelessImages(documentObject);
  scrubby.filterInvalidAnchors(documentObject);

  const baseURLString = getEntryURLString(entry);
  const baseURLObject = new URL(baseURLString);
  resolveDocumentURLs(documentObject, baseURLObject);

  filterTrackingImages(documentObject);

  await setImageDimensions(documentObject, options.fetchImageTimeoutMillis);

  const prepURLString = getEntryURLString(entry);
  prepareDocument(prepURLString, documentObject);

  entry.content = documentObject.documentElement.outerHTML.trim();
}

async function setEntryIcon(entry, iconConn, fallbackURLString) {
  const lookupURLString = getEntryURLString(entry);
  const lookupURLObject = new URL(lookupURLString);
  const iconURLString = await favicon.lookup(iconConn, lookupURLObject);
  entry.faviconURLString = iconURLString || fallbackURLString;
}

function isEntryURLValid(entry, verbose) {
  const urlString = entry.urls[0];
  let urlObject;
  try {
    urlObject = new URL(urlString);
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }

    return false;
  }

  // Hack for a bad feed
  // TODO: this does not belong here and should be exposed elsewhere
  if(urlObject.pathname.startsWith('//')) {
    return false;
  }

  return true;
}

function isFeedUnmodified(localDateModified, remoteDateModified) {
  return localDateModified && remoteDateModified &&
    localDateModified.getTime() === remoteDateModified.getTime();
}

function filterDuplicateEntries(entries) {
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

// Rewrites the entry's url and then attempts to append the rewritten url to
// the entry. Returns true if a new url was appended. Note a new url may have
// been generated but if it already existed in urls then this still returns
// false.
function rewriteEntryURL(entry) {
  const urlString = getEntryURLString(entry);
  const rewrittenURLString = rewriteURLString(urlString);
  return rewrittenURLString && addEntryURLString(entry, rewrittenURLString);
}

// Returns true if the entry should be excluded from processing
function shouldExcludeEntry(entry) {

  // Treat the latest url as representative of the entry
  const urlString = getEntryURLString(entry);

  // This should never throw because we know the url is valid
  const urlObject = new URL(urlString);
  const hostname = urlObject.hostname;

  // TODO: these should probably involve regular expressions so that
  // I do not need to test against url variations (like leading www.).
  const interstitialHosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  if(interstitialHosts.includes(hostname)) {
    return true;
  }

  const scriptedHosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  if(scriptedHosts.includes(hostname)) {
    return true;
  }

  const paywallHosts = [
    'www.nytimes.com',
    'myaccount.nytimes.com',
    'open.blogs.nytimes.com'
  ];
  if(paywallHosts.includes(hostname)) {
    return true;
  }

  const cookieHosts = [
    'www.heraldsun.com.au',
    'ripe73.ripe.net'
  ];
  if(cookieHosts.includes(hostname)) {
    return true;
  }

  if(sniff.sniffNonHTML(urlObject.pathname)) {
    return true;
  }

  return false;
}


// TODO: deprecate in favor of put, and after moving sanitization and
// default props out, maybe make a helper function in pollfeeds that does this
// TODO: ensure entries added by put, if not have id, have unread flag
// and date created
// TODO: this should be nothing other than putting. Caller is responsible
// for sanitizing and setting defaults.
function addEntryToDb(conn, entry) {
  return new Promise((resolve, reject) => {
    if('id' in entry) {
      return reject(new TypeError('Cannot add an entry with an id'));
    }

    const sanitized = sanitizeEntry(entry);
    const storable = filterEmptyProperties(sanitized);
    storable.readState = ENTRY_STATE_UNREAD;
    storable.archiveState = ENTRY_STATE_UNARCHIVED;
    storable.dateCreated = new Date();
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.add(storable);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addEntry(readerConn, entry, verbose) {
  try {
    let addedEntry = await addEntryToDb(readerConn, entry);
    return true;
  } catch(error) {
    if(verbose) {
      const urlString = getEntryURLString(entry);
      console.warn(error, urlString);
    }
  }
  return false;
}

function stripURLHash(urlString) {
  const urlObject = new URL(urlString);
  urlObject.hash = '';
  return urlObject.href;
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

// To determine where there was a redirect, compare the response url to the
// entry's current urls, ignoring the hash.
function didRedirect(urlArray, responseURLString) {

  // Double check because includes below may not error out when undefined
  if(!responseURLString) {
    throw new TypeError('Invalid parameter responseURLString');
  }

  const normalizedURLArray = urlArray.map(stripURLHash);
  return !normalizedURLArray.includes(responseURLString);
}

function parseHTML(htmlString) {
  const parser = new DOMParser();
  const document = parser.parseFromString(htmlString, 'text/html');
  if(!document) {
    throw new Error('parseHTML did not produce a document, first 100 chars: ',
      htmlString.substring(100));
  }
  const parserErrorElement = document.querySelector('parsererror');
  if(parserErrorElement) {
    throw new Error(parserErrorElement.textContent);
  }
  return document;
}

// TODO: update caller to use logObject
function prepareLocalEntry(entry, verbose) {

  // Not all entries are guaranteed to have content, so exit early if possible
  if(!entry.content) {
    return;
  }

  let documentObject;
  try {
    documentObject = parseHTML(entry.content);
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
    return;
  }

  const urlString = getEntryURLString(entry);
  prepareDocument(urlString, documentObject);

  const content = documentObject.documentElement.outerHTML.trim();
  if(content) {
    entry.content = content;
  }
}

function prepareDocument(urlString, documentObject) {
  pruneWithTemplate(urlString, documentObject);
  filterBoilerplate(documentObject);
  scrubby.scrub(documentObject);
  scrubby.addNoReferrer(documentObject);
}

function queryIdleState(idlePeriodSeconds) {
  return new Promise(function(resolve) {
    chrome.idle.queryState(idlePeriodSeconds, resolve);
  });
}


// TODO: accept a base url parameter, and do not filter images from that host
// so that feeds from that host still work
function filterTrackingImages(documentObject) {

  const telemetryHosts = [
    'ad.doubleclick.net',
    'b.scorecardresearch.com',
    'googleads.g.doubleclick.net',
    'me.effectivemeasure.net',
    'pagead2.googlesyndication.com',
    'pixel.quantserve.com',
    'pixel.wp.com',
    'pubads.g.doubleclick.net',
    'sb.scorecardresearch.com',
    'stats.bbc.co.uk'
  ];

  // 1char hostname . 1char domain
  const minValidURLLength = 3;

  const imageList = documentObject.querySelectorAll('img[src]');

  for(let imageElement of imageList) {

    let urlString = imageElement.getAttribute('src');
    if(!urlString) {
      continue;
    }

    urlString = urlString.trim();
    if(!urlString) {
      continue;
    }

    if(urlString.length < minValidURLLength) {
      continue;
    }

    if(urlString.includes(' ')) {
      continue;
    }

    if(!/^https?:/i.test(urlString)) {
      continue;
    }

    let urlObject;
    try {
      urlObject = new URL(urlString);
    } catch(error) {
      continue;
    }

    if(telemetryHosts.includes(url.hostname)) {
      imageElement.remove();
    }
  }
}

// experimental
function isMeteredConnection() {
  return navigator.connection && navigator.connection.metered;
}

function isOffline() {
  return 'onLine' in navigator && !navigator.onLine;
}

function broadcastCompletedMessage() {
  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();
}

// Applies a set of rules to a url object and returns a modified url object
// Returns undefined if no rewriting occurred
// @param url {String}
// @returns {String}
function rewriteURLString(urlString) {
  const urlObject = new URL(urlString);
  if(urlObject.hostname === 'news.google.com' &&
    urlObject.pathname === '/news/url') {
    return urlObject.searchParams.get('url');
  } else if(urlObject.hostname === 'techcrunch.com' &&
    urlObject.searchParams.has('ncid')) {
    urlObject.searchParams.delete('ncid');
    return urlObject.href;
  }
}

function pruneWithTemplate(urlString, documentObject) {
  const templateHostMap = {};

  templateHostMap['www.washingtonpost.com'] = [
    'header#wp-header',
    'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit',
    'div.moat-trackable'
  ];

  templateHostMap['theweek.com'] = ['div#head-wrap'];
  templateHostMap['www.usnews.com'] = ['header.header'];

  let urlObject;
  try {
    urlObject = new URL(urlString);
  } catch(error) {
    return;
  }

  const selectorsArray = templateHostMap[urlObject.hostname];
  const selector = selectorsArray.join(',');
  const elementList = documentObject.querySelectorAll(selector);
  for(let element of elementList) {
    element.remove();
  }
}

} // End file block scope
