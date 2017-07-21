// See license.md

'use strict';

{ // Begin file block scope

// Returns the feed that was added if successful
async function subscribe(dbConn, iconConn, feed, options) {

  options = options || {};
  const fetchFeedTimeoutMillis = 'fetchFeedTimeoutMillis' in options ?
    options.fetchFeedTimeoutMillis : 2000;
  const suppressNotifications = 'suppressNotifications' in options ?
    options.suppressNotifications : false;
  const verbose = options.verbose;

  const urlString = getFeedURLString(feed);
  if(verbose) {
    console.log('Subscribing to feed with url', urlString);
  }

  const isExistingURL = await containsFeedURL(dbConn, urlString);
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

    const addedFeed = await addFeedToDb(dbConn, feed);
    return addedFeed;
  }

  const remoteFeed = await fetchInternal(urlString);
  if(await checkIfRedirectURLExists(remoteFeed, verbose)) {
    return;
  }
  const mergedFeed = mergeFeeds(feed, remoteFeed);
  await setIcon(iconConn, mergedFeed, verbose);
  const addedFeed = await addFeedToDb(dbConn, mergedFeed);
  if(!suppressNotifications) {
    notify(addedFeed);
  }
  return addedFeed;
}

this.subscribe = subscribe;


// Looks up and set a feed's favicon
async function setIcon(iconConn, feed, verbose) {
  const lookupURLObject = createFeedIconLookupURL(feed);
  let didSetIcon = false;
  try {
    const iconURLString = await favicon.lookup(iconConn, lookupURLObject);
    if(iconURLString) {
      feed.faviconURLString = iconURLString;
      didSetIcon = true;
    }
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
  }
  return didSetIcon;
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

async function fetchInternal(urlString) {
  let feed;
  try {
    const fetchResult = await fetchFeed(urlString, fetchFeedTimeoutMillis);
    return fetchResult.feed;
  } catch(error) {
    if(verbose) {
      console.warn(urlString, error);
    }
  }
}

// TODO: it would probably be better if fetchFeed exposed a redirected
// property to test against and this took the fetch result as input instead
async function checkIfRedirectURLExists(feed, verbose) {
  if(feed.urls.length < 2) {
    return false;
  }

  const urlString = getFeedURLString(feed);
  const isExists = await containsFeedURL(dbConn, urlString);

  if(isExists) {
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
