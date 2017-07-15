// See license.md

'use strict';

// TODO: do something like a default options object, and have main entry point
// accept an options parameter that defaults to the default options object
// Do not use these semi-globals
// TODO: use a verbose param instead of the log object

{ // Begin file block scope

const defaults = {};
// If true, then output log messages to the console
defaults.verbose = false;
// If true, then allow metered connections
defaults.allowMetered = true;
// If true, then allow polling even if not idle
defaults.ignoreIdleState = false;
// If true, whether to poll feeds that were recently polled
defaults.skipRecencyCheck = false;
// If true, whether to continue processing feeds not modified
defaults.skipModifiedCheck = false;
// Must idle for this many seconds before considered idle
defaults.idlePeriodSeconds = 30;
// Period (ms) during which feeds considered recently polled
defaults.recencyPeriodMillis = 5 * 60 * 1000;
// How many ms before feed fetch times out
defaults.fetchFeedTimeoutMillis = 5000;
// How many ms before html fetch times out
defaults.fetchHTMLTimeoutMillis = 5000;
// How many ms before image fetch times out
defaults.fetchImageTimeoutMillis = 3000;


async function pollFeeds(options = defaults) {

  initOptions(options);

  if(options.verbose) {
    console.log('Checking for new articles...');
  }

  const shouldStartPoll = await checkPollStartingConditions(options);
  if(!shouldStartPoll) {
    return;
  }

  // TODO: num WHAT added?
  let numEntriesAdded = 0;

  const connectionPromises = [db.connect(),
    favicon.connect()];
  let readerConn, iconConn;

  try {
    const connections = await Promise.all(connectionPromises);
    readerConn = connections[0];
    iconConn = connections[1];

    let feeds = await db.getFeeds(readerConn);

    if(!options.skipRecencyCheck) {
      feeds = feeds.filter(isFeedNotRecent);
    }

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

  if(numEntriesAdded) {
    const title = 'Added articles';
    const message = `Added ${numEntriesAdded} articles`;
    showNotification(title, message);
  }

  broadcastCompletedMessage();

  if(options.verbose) {
    console.log('Polling completed');
  }

  return numEntriesAdded;
}

this.pollFeeds = pollFeeds;


function initOptions(options) {
  options.verbose = 'verbose' in options ? options.verbose : defaults.verbose;

  // TODO: init the rest
}

// Concurrently process feeds
async function processFeeds(readerConn, iconConn, feeds, options) {
  const promises = new Array(feeds.length);
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



// TODO: caller needs to pass in logObject
function isFeedNotRecent(logObject, feedObject) {

  // Never considered feeds that have not been fetched as recent
  if(!feedObject.dateFetched) {
    return true;
  }

  const millisElapsedSinceLastPoll = new Date() - feedObject.dateFetched;
  const wasPolledRecently =
    millisElapsedSinceLastPoll < recencyPeriodMillis;

  if(logObject && wasPolledRecently) {
    logObject.debug('Feed polled too recently', getFeedURLString(feedObject));
  }

  return !wasPolledRecently;
}


// Suppresses processFeed exceptions to avoid Promise.all fail fast
// behavior
async function processFeedSilently(readerConn, iconConn, feedObject, options) {
  let numEntriesAdded = 0;
  try {
    numEntriesAdded = await jrPollProcessFeed(logObject, feedObject);
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }
  }
  return numEntriesAdded;
}

// TODO: reverse params
function jrPollEntryURLIsValid(logObject, entryObject) {
  const urlString = entryObject.urls[0];
  let urlObject;
  try {
    urlObject = new URL(urlString);
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
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

function jrPollEntryHasURL(entryObject) {
  return entryObject.urls && entryObject.urls.length;
}

// TODO: this should only accept date parameter instead of remote feed object,
// following principle of narrowest parameter usage
function jrPollIsFeedUnmodified(localFeedObject, remoteFeedObject) {
  return localFeedObject.dateUpdated &&
    localFeedObject.dateLastModified &&
    remoteFeedObject.dateLastModified &&
    localFeedObject.dateLastModified.getTime() ===
    remoteFeedObject.dateLastModified.getTime();
}

function jrPollFilterDuplicateEntries(entryArray) {
  const distinctEntryArray = [];
  const seenURLArray = [];

  for(let entryObject of entryArray) {
    let isPreviouslySeenURL = false;
    for(let urlString of entryObject.urls) {
      if(seenURLArray.includes(urlString)) {
        isPreviouslySeenURL = true;
        break;
      }
    }

    if(!isPreviouslySeenURL) {
      distinctEntryArray.push(entryObject);
      seenURLArray.push(...entryObject.urls);
    }
  }

  return distinctEntryArray;
}

// TODO: log parameter, options parameter
async function jrPollProcessFeed(localFeed) {
  // TODO: use a clearer name? num what added?
  let numAdded = 0;

  // TODO: use clearer name? is this string or object?
  const url = getFeedURLString(localFeed);

  // Explicit assignment due to strange destructuring rename behavior
  // TODO: ensure destructuring names are exact, this used to say feed but now
  // named feedObject
  const {feedObject, entries} = await fetchFeed(url,
    fetchFeedTimeoutMillis);
  const remoteFeed = feedObject;
  let remoteEntries = entries;

  if(!skipModifiedCheck &&
    jrPollIsFeedUnmodified(localFeed, remoteFeed)) {

    if(logObject) {
      logObject.debug('Feed not modified', url, localFeed.dateLastModified,
        remoteFeed.dateLastModified);
    }

    return numAdded;
  }

  const mergedFeed = jrFeedMerge(localFeed, remoteFeed);
  let storableFeed = sanitizeFeed(mergedFeed);
  storableFeed = filterEmptyProperties(storableFeed);

  remoteEntries = remoteEntries.filter(jrPollEntryHasURL);
  remoteEntries = remoteEntries.filter(jrPollEntryURLIsValid);
  remoteEntries = jrPollFilterDuplicateEntries(remoteEntries);
  remoteEntries.forEach((e) => e.feed = localFeed.id);
  remoteEntries.forEach((e) => e.feedTitle = storableFeed.title);

  // TODO: feedStore should be an instance variable
  const feedStore = new FeedStore();
  feedStore.conn = readerConn;

  // TODO: why pass feed? Maybe it isn't needed by jrProcessEntry? Can't I just
  // do any delegation of props now, so that jrProcessEntry does not need to
  // have any knowledge of the feed?
  const promises = remoteEntries.map((entryObject) => jrProcessEntry(
    storableFeed, entryObject));
  promises.push(feedStore.put(storableFeed));
  const resolutions = await Promise.all(promises);
  resolutions.pop();// remove feedStore.put promise
  return resolutions.reduce((sum, r) => r ? sum + 1 : sum, 0);
}

// Attempts to append the rewritten url to the entry.
// Returns true if a new url was appended. Note a new url may have been
// generated but if it already existed in urls then this still returns false
function jrPollRewriteEntryURL(entryObject) {
  const beforeAppendLength = entryObject.urls.length;
  const urlString = entry.getURLString(entryObject);
  const rewrittenURLString = jrPollRewriteURLString(urlString);

  if(rewrittenURLString) {
    entry.addURLString(entryObject, rewrittenURLString);
  }
  const didAppendURL = entryObject.urls.length > beforeAppendLength;
  return didAppendURL;
}

// Resolve with true if entry was added, false if not added
// TODO: instead of trying to not reject in case of an error, maybe this should
// reject, and I use a wrapping function than translates rejections into
// negative resolutions
// TODO: favicon lookup should be deferred until after fetch to avoid
// lookup up intermediate urls when possible
// TODO: this is a pretty large function, it should be broken up into helper
// functions. One low hanging fruit would be the favicon stuff.
// TODO: feed is very rarely used in this function, it might be better to use
// only the exact properties needed
async function jrProcessEntry(logObject, feedObject, entryObject) {

  // TODO: entry store is deprecated
  // const entryStore = new EntryStore();
  // entryStore.conn = readerConn;

  // First try and rewrite the url
  const didAppendRewrittenURL = jrPollRewriteEntryURL(entryObject);

  // Check if the entry should be ignored based on its url
  if(jrPollShouldExcludeEntry(entryObject)) {
    return false;
  }

  // Check if the initial url already exists in the database
  const originalURLString = entryObject.urls[0];
  if(await entryStore.containsURL(originalURLString)) {
    return false;
  }

  // Check if the rewritten url already exists in the database
  if(didAppendRewrittenURL) {
    const rewrittenURLString = entry.getURLString(entryObject);
    const isExistingRewrittenURL = await entryStore.containsURL(
      rewrittenURLString);
    if(isExistingRewrittenURL) {
      return false;
    }
  }

  // Set the entry's favicon url
  // TODO: move these into a helper function
  // TODO: use try / finally for favicon connection and close it
  //      - which means this should be shared
  const faviconDbConn = await favicon.connect();
  const lookupURLString = entry.getURLString(entryObject);
  const lookupURLObject = new URL(lookupURLString);
  const iconURL = await favicon.lookup(faviconDbConn, lookupURLObject);
  entryObject.faviconURLString = iconURL || feedObject.faviconURLString;

  // Fetch the entry's full text

  // TODO: a minor optimization. If I break apart fetching html text and parsing
  // into a DOM, then the redirect exists check could happen before parsing
  // into a DOM, saving processing

  const fetchURLString = entry.getURLString(entryObject);
  let documentObject, responseURLString;
  try {
    // TODO: now that I renamed these variables, this will not work
    ({documentObject, responseURLString} = await fetchHTML(
      fetchURLString, fetchHTMLTimeoutMillis));
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }

    // If there was a problem fetching, then we still want to store the content
    // as is. Prepare the content
    jrPollPrepareLocalEntry(entryObject);

    // Store the entry and then exit
    const storedEntry = await jrPollAddEntry(entryObject);
    return storedEntry;
  }

  // Check if a redirect occurred when fetching
  const didRedirect = jrPollDidRedirect(entryObject.urls, responseURLString);
  if(didRedirect) {

    // If redirected, check if the redirect url exists in the database
    if(await entryStore.containsURL(responseURLString)) {
      return false;
    }

    // If redirected, append the redirected url
    entry.addURLString(entryObject, responseURLString);
  }

  // Process the entry's full text
  jrPollTransformLazyImages(documentObject);
  jrDOMScrubFilterSourcelessImages(documentObject);
  jrDOMScrubFilterInvalidAnchors(documentObject);

  const baseURLString = entry.getURLString(entryObject);
  const baseURLObject = new URL(baseURLString);
  resolveDocumentURLs(documentObject, resolveBaseURLObject);

  jrPollFilterTrackingImages(documentObject);

  await setImageDimensions(documentObject,
    fetchImageTimeoutMillis);

  const prepURLString = entry.getURLString(entryObject);
  jrPollPrepareDocument(prepURLString, documentObject);

  entryObject.content = documentObject.documentElement.outerHTML.trim();
  return await jrPollAddEntry(entryObject);
}

// Returns true if the entry should be excluded from processing
function jrPollShouldExcludeEntry(entryObject) {

  // Treat the latest url as representative of the entry
  const urlString = entry.getURLString(entryObject);

  // This should never throw because we know the url is valid
  const urlObject = new URL(urlString);
  const hostname = urlObject.hostname;

  // TODO: theses looks should probably involve regular expressions so that
  // I do not need to test against url variations (like leading www.). I lose
  // the ability to use Array.prototype.includes but I think it is acceptable
  // since it is basically a function call either way
  // TODO: I think it would make more sense to pass url objects around here
  // to guarantee the characteristics of the url type, so that I do not need
  // to ever worry about situations where I accidentally include the protocol
  // in the string


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

  // TODO: is this test coherent enough, sufficiently related to these
  // other tests to merit including it here, or rather is it not related
  // and therefore does not belong. Kind of makes me wonder if composing
  // these tests together, as an abstraction, is even warranted

  const pathname = urlObject.pathname;
  if(sniffNonHTMLPath(pathname)) {
    return true;
  }

  return false;
}


// TODO: caller needs to pass logObject now
async function jrPollAddEntry(logObject, entryObject) {

  // TODO: entry store is deprecated
  const entryStore = new EntryStore();
  entryStore.conn = readerConn;

  try {
    // TODO: entryStore.add is deprecated
    // TODO: clarify what is result, so I do not have to remember what
    // entryStore.add returns
    let result = await entryStore.add(entryObject);
  } catch(error) {
    if(logObject) {
      const urlString = entry.getURLString(entryObject);
      logObject.warn(error, urlString);
    }
    return false;
  }

  return true;
}

function jrPollStripURLHash(urlString) {
  const urlObject = new URL(urlString);
  urlObject.hash = '';
  return urlObject.href;
}


// To determine where there was a redirect, compare the response url to the
// entry's current urls, ignoring the hash.
function jrPollDidRedirect(urlArray, responseURLString) {

  // Double check because includes below may not error out when undefined
  if(!responseURLString) {
    throw new TypeError('Invalid parameter responseURLString');
  }

  const normalizedURLArray = urlArray.map(jrPollStripURLHash);
  return !normalizedURLArray.includes(responseURLString);
}

// TODO: update caller to use logObject
function jrPollPrepareLocalEntry(logObject, entryObject) {

  // Not all entries are guaranteed to have content, so exit early if possible
  if(!entryObject.content) {
    return;
  }

  const parser = new DOMParser();
  let documentObject;
  try {
    documentObject = parser.parseFromString(entryObject.content, 'text/html');
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }
  }

  if(!documentObject || documentObject.querySelector('parsererror')) {
    entryObject.content = 'Cannot show document due to parsing error';
    return;
  }

  const urlString = entry.getURLString(entryObject);
  jrPollPrepareDocument(urlString, documentObject);

  const content = documentObject.documentElement.outerHTML.trim();
  if(content) {
    entryObject.content = content;
  }
}

function jrPollPrepareDocument(urlString, documentObject) {
  jrTemplatePrune(urlString, documentObject);
  filterBoilerplate(documentObject);
  scrubby.scrub(documentObject);
  scrubby.addNoReferrer(documentObject);
}

function queryIdleState(idlePeriodSeconds) {
  return new Promise(function(resolve) {
    chrome.idle.queryState(idlePeriodSeconds, resolve);
  });
}

// Scans the images in a document and modifies images that appear to be
// lazily loaded images
function jrPollTransformLazyImages(documentObject) {

  const lazyImageAttributes = [
    'load-src',
    'data-src',
    'data-original-desktop',
    'data-baseurl',
    'data-lazy',
    'data-img-src',
    'data-original',
    'data-adaptive-img',
    'data-imgsrc',
    'data-default-src'
  ];


  let numModified = 0;
  const imageList = documentObject.querySelectorAll('img');

  for(let imageElement of imageList) {

    // Images with these attributes are not lazy loaded
    if(imageElement.hasAttribute('src') ||
      imageElement.hasAttribute('srcset')) {
      continue;
    }

    for(let alternateName of lazyImageAttributes) {
      if(imageElement.hasAttribute(alternateName)) {
        const urlString = imageElement.getAttribute(alternateName);
        if(urlString && !urlString.trim().includes(' ')) {
          imageElement.removeAttribute(alternateName);
          imageElement.setAttribute('src', urlString);
          numModified++;
          break;
        }
      }
    }
  }

  return numModified;
}

function jrPollFilterTrackingImages(documentObject) {

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
function jrPollRewriteURLString(urlString) {
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


// Guess if the url path is not an html mime type
function sniffNonHTMLPath(pathString) {
  const typeString = sniffTypeFromPath(pathString);
  if(typeString) {
    const slashPosition = type.indexOf('/');
    const superTypeString = typeString.substring(0, slashPosition);
    const nonHTMLSuperTypes = ['application', 'audio', 'image', 'video'];
    return nonHTMLSuperTypes.includes(superTypeString);
  }
}


// Guess the mime type of the url path by looking at the filename extension
function sniffTypeFromPath(pathString) {

  const extensionMimeMap = {
    'ai':   'application/postscript',
    'aif':  'audio/aiff',
    'atom': 'application/atom+xml',
    'avi':  'video/avi',
    'bin':  'application/octet-stream',
    'bmp':  'image/bmp',
    'c':    'text/plain',
    'cc':   'text/plain',
    'cgi':  'text/hml',
    'class':'application/java',
    'cpp':  'text/plain',
    'css':  'text/css',
    'doc':  'application/msword',
    'docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'exe':  'application/octet-stream',
    'flac': 'audio/flac',
    'fli':  'video/fli',
    'gif':  'image/gif',
    'gz':   'application/x-gzip',
    'h':    'text/plain',
    'htm':  'text/html',
    'html': 'text/html',
    'ico':  'image/x-icon',
    'java': 'text/plain',
    'jpg':  'image/jpg',
    'js':   'application/javascript',
    'json': 'application/json',
    'jsp':  'text/html',
    'log':  'text/plain',
    'md':   'text/plain',
    'midi': 'audio/midi',
    'mov':  'video/quicktime',
    'mp2':  'audio/mpeg', // can also be video
    'mp3':  'audio/mpeg3', // can also be video
    'mpg':  'audio/mpeg', // can also be video
    'ogg':  'audio/ogg',
    'ogv':  'video/ovg',
    'pdf':  'application/pdf',
    'php':  'text/html',
    'pl':   'text/html',
    'png':  'image/png',
    'pps':  'application/vnd.ms-powerpoint',
    'ppt':  'application/vnd.ms-powerpoint',
    'pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'rar':  'application/octet-stream',
    'rss':  'application/rss+xml',
    'svg':  'image/svg+xml',
    'swf':  'application/x-shockwave-flash',
    'tiff': 'image/tiff',
    'wav':  'audio/wav',
    'xls':  'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xml':  'application/xml',
    'zip':  'application/zip'
  };

  const extensionString = findPathExtension(pathString);
  if(extensionString) {
    return extensionMimeMap[extensionString];
  }
}


// TODO: retest handling of 'foo.' input
// Returns a file's extension. Some extensions are ignored because this must
// differentiate between paths containing periods and file names, but this
// favors reducing false positives (returning an extension that is not one) even
// if there are false negatives (failing to return an extension when there is
// one). The majority of inputs will pass, it is only the pathological cases
// that are of any concern. The cost of returning the wrong extension is greater
// than not returning the correct extension because this is a factor of deciding
// whether to filter content.
// @param pathString {String} path to analyze (paths should have leading /)
// @returns {String} lowercase extension or undefined
 function findPathExtension(pathString) {

  // pathString is required
  // TODO: allow an exception to happen instead of checking
  if(!pathString) {
    return;
  }

  // TODO: check that the first character is a '/' to partially validate path
  // if not, throw a new TypeError
  // I want validation here because the minimum length check below assumes the
  // path starts with a '/', so this function has to assume that, but I do not
  // want the caller have to explicitly check
  // This implicitly also asserts the path is left-trimmed.

  // TODO: check that the last character of the path is not a space. Paths
  // should always be right trimmed.

  // If the path is shorter than the smallest path that could contain an
  // exception, then this will not be able to find an exception, so exit early
  const minPathLength = '/a.b'.length;
  if(pathString.length < minPathLength) {
    return;
  }

  // Assume the absence of a period means no extension can be found
  const lastDotPosition = pathString.lastIndexOf('.');
  if(lastDotPosition === -1) {
    return;
  }

  // The +1 skips past the period
  const extensionString = pathString.substring(lastDotPosition + 1);

  // If the pathString ended with a dot, then the extension string will be
  // empty, so assume the path is malformed and no extension exists
  // We do not even need to access the length property here, '' is falsy
  if(!extensionString) {
    return;
  }

  // If the extension has too many characters, assume it is probably not an
  // extension and something else, so there is no extension
  const maxExtensionLength = 6;
  if(extensionString.length < maxExtensionLength) {
    return;
  }

  // Require extensions to have at least one alphabetical character
  if(/[a-z]/i.test(extensionString)) {
    // Normalize the extension string to lowercase form. Corresponds to
    // mime mapping table lookup case.
    // Assume no trailing space, so no need to trim
    return extensionString.toLowerCase();
  }
}



function jrTemplatePrune(urlString, documentObject) {


  const jrTemplateHostMap = {};

  jrTemplateHostMap['www.washingtonpost.com'] = [
    'header#wp-header',
    'div.top-sharebar-wrapper',
    'div.newsletter-inline-unit',
    'div.moat-trackable'
  ];

  jrTemplateHostMap['theweek.com'] = ['div#head-wrap'];
  jrTemplateHostMap['www.usnews.com'] = ['header.header'];



  let urlObject;

  try {
    urlObject = new URL(urlString);
  } catch(error) {
    return;
  }

  const selectorsArray = jrTemplateHostMap[urlObject.hostname];
  const selector = selectorsArray.join(',');
  const elementList = documentObject.querySelectorAll(selector);
  for(let element of elementList) {
    element.remove();
  }
}

} // End file block scope
