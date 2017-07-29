// See license.md

'use strict';

{ // Begin file block scope

// Returns the feed that was added if successful
async function subscribe(readerConn, iconConn, feed, options) {

  options = options || {};
  const timeoutMillis = 'timeoutMillis' in options ?
    options.timeoutMillis : 2000;
  const suppressNotifications = 'suppressNotifications' in options ?
    options.suppressNotifications : false;
  const verbose = options.verbose;

  const urlString = getFeedURLString(feed);
  if(verbose) {
    console.log('Subscribing to feed with url', urlString);
  }

  const isExistingURL = await containsFeedURL(readerConn, urlString);
  if(isExistingURL) {
    if(verbose) {
      console.warn('Already subscribed to feed with url', urlString);
    }

    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    if(verbose) {
      console.debug('Proceeding with offline subscription to', urlString);
    }

    const addedFeed = await addFeedToDb(readerConn, feed);
    return addedFeed;
  }

  const response = await fetchInternal(urlString, timeoutMillis,
    verbose);
  const responseURLString = response.responseURLString;
  if(response.redirected &&
    await checkIfRedirectURLExists(readerConn, responseURLString, verbose)) {
    return;
  }

  const parseResult = parseFetchedFeed(response);
  const remoteFeed = parseResult.feed;
  const mergedFeed = mergeFeeds(feed, remoteFeed);
  await setIcon(iconConn, mergedFeed, verbose);
  const addedFeed = await addFeedToDb(readerConn, mergedFeed);
  if(!suppressNotifications) {
    notify(addedFeed);
  }
  return addedFeed;
}

this.subscribe = subscribe;

// Looks up and set a feed's favicon
async function setIcon(iconConn, feed, verbose) {
  let maxAgeMillis, fetchHTMLTimeoutMillis, fetchImageTimeoutMillis,
    minImageByteSize, maxImageByteSize, iconURLString;
  const lookupURLObject = createFeedIconLookupURL(feed);
  const lookupPromise = lookupFavicon(iconConn, lookupURLObject, maxAgeMillis,
    fetchHTMLTimeoutMillis, fetchImageTimeoutMillis, minImageByteSize,
    maxImageByteSize, verbose);
  try {
    iconURLString = await lookupPromise;
  } catch(error) {
    console.warn(error); // always warn
  }

  if(iconURLString) {
    feed.faviconURLString = iconURLString;
    return true;
  }
  return false;
}

// Returns true if a feed exists in the database with the given url
function containsFeedURL(conn, urlString) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

function notify(feed) {
  const title = 'Subscription complete';
  const feedName = feed.title || getFeedURLString(feed);
  const message = 'Subscribed to ' + feedName;
  showNotification(title, message, feed.faviconURLString);
}

async function fetchInternal(urlString, timeoutMillis, verbose) {
  const acceptHTML = true;
  const promise = fetchFeed(urlString, timeoutMillis, acceptHTML);
  try {
    return await promise;
  } catch(error) {
    if(verbose) {
      console.warn(urlString, error);
    }
  }
}

async function checkIfRedirectURLExists(readerConn, responseURLString, verbose) {
  if(await containsFeedURL(readerConn, responseURLString)) {
    if(verbose) {
      console.warn('Already subscribed to feed with redirected url',
        redirectURLString);
    }

    return true;
  }
  return false;
}

// TODO: this should not be doing anything other than adding the object it
// was given
// TODO: deprecate, require caller to use putFeed everywhere
// TODO: move obj prep to caller, use put logic, rename to putFeed
function addFeedToDb(conn, feed) {
  return new Promise((resolve, reject) => {
    if('id' in feed)
      return reject(new TypeError());
    let storable = sanitizeFeed(feed);
    storable = filterEmptyProperties(storable);
    storable.dateCreated = new Date();
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.add(storable);
    request.onsuccess = () => {
      storable.id = request.result;
      resolve(storable);
    };
    request.onerror = () => reject(request.error);
  });
}

} // End file block scope
