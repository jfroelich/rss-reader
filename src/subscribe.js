// See license.md
'use strict';

{ // Begin file block scope

// Returns the feed that was added if successful
async function subscribe(readerConn, iconConn, feed, timeoutMillis,
  suppressNotifications, verbose) {
  if(typeof timeoutMillis === 'undefined') {
    timeoutMillis = 2000;
  }

  const urlString = Feed.prototype.getURL.call(feed);
  if(verbose) {
    console.log('Subscribing to feed with url', urlString);
  }

  if(await containsFeedURL(readerConn, urlString)) {
    if(verbose) {
      console.warn('Already subscribed to feed with url', urlString);
    }
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    if(verbose) {
      console.debug('Proceeding with offline subscription to', urlString);
    }
    const storableFeed = prepareFeedForDatabase(feed);
    const addedFeed = await addFeedToDb(readerConn, storableFeed);
    if(!suppressNotifications) {
      showSubscribeNotification(addedFeed);
    }
    return addedFeed;
  }

  const response = await fetchInternal(urlString, timeoutMillis, verbose);
  const responseURLString = response.responseURLString;
  if(response.redirected &&
    await checkIfRedirectURLExists(readerConn, responseURLString, verbose)) {
    return;
  }

  const parseResult = parseFetchedFeed(response);
  const remoteFeed = parseResult.feed;
  const mergedFeed = mergeFeeds(feed, remoteFeed);
  await setIcon(iconConn, mergedFeed, verbose);
  const storableFeed = prepareFeedForDatabase(mergedFeed);
  const addedFeed = await addFeedToDb(readerConn, storableFeed);
  if(!suppressNotifications) {
    showSubscribeNotification(addedFeed);
  }
  return addedFeed;
}

// Looks up and set a feed's favicon
async function setIcon(iconConn, feed, verbose) {
  let maxAgeMillis, fetchHTMLTimeoutMillis, fetchImageTimeoutMillis,
    minImageByteSize, maxImageByteSize, iconURLString;
  const lookupURLObject = Feed.prototype.createIconLookupURL.call(feed);
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

// TODO: this is so similar to containsFeedURL that it should be deprecated,
// the only difference is basically the log message, which isn't important
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


function showSubscribeNotification(feed) {
  const title = 'Subscription complete';
  const feedName = feed.title || Feed.prototype.getURL.call(feed);
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

// Returns a basic copy of the input feed that is suitable for storage in
// indexedDB
function prepareFeedForDatabase(feed) {
  let storable = Feed.prototype.sanitize.call(feed);
  storable = filterEmptyProperties(storable);
  storable.dateCreated = new Date();
  return storable;
}

function addFeedToDb(conn, feed) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(storable);
    request.onsuccess = function() {
      storable.id = request.result;
      resolve(storable);
    };
    request.onerror = function() {
      reject(request.error);
    };
  });
}

this.subscribe = subscribe;

} // End file block scope
