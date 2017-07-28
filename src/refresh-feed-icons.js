// See license.md

'use strict';

{ // Begin file block scope

// Scans through all the feeds in the database and attempts to update each
// feed's favicon property.
async function refreshFeedIcons(verbose) {
  if(verbose) {
    console.log('Refreshing feed favicons...');
  }

  let numModified = 0;
  let readerConn, iconConn;
  let iconDbName, iconDbVersion, connectTimeoutMillis;

  const readerConnPromise = openReaderDb();
  const iconConnPromise = openFaviconDb(iconDbName, iconDbVersion,
    connectTimeoutMillis, verbose);
  const promises = [readerConnPromise, iconConnPromise];
  const connectionPromise = Promise.all(promises);

  try {
    const connections = await connectionPromise;
    readerConn = connections[0];
    iconConn = connections[1];
    const feeds = await loadAllFeedsFromDb(readerConn);
    const resolutions = await processFeeds(feeds, readerConn, iconConn);
    numModified = getNumModified(resolutions);
  } finally {
    if(readerConn) {
      readerConn.close();
    }
    if(iconConn) {
      iconConn.close();
    }
  }

  if(verbose) {
    console.log('Refreshing feed favicons modified %d feeds', numModified);
  }

  return numModified;
}

this.refreshFeedIcons = refreshFeedIcons;

async function processFeeds(feeds, readerConn, iconConn) {
  const promises = new Array(feeds.length);
  for(let feed of feeds) {
    const promise = lookupFeedIconAndUpdateFeed(feed, readerConn, iconConn);
    promises.push(promise);
  }
  return await Promise.all(promises);
}

function getNumModified(resolutions) {
  let numModified = 0;
  for(let didUpdate of resolutions) {
    if(didUpdate) {
      numModified++;
    }
  }
  return numModified;
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

// Returns true if the feed was updated
// TODO: separate into two functions, one that looks up, one that
// does the update
async function lookupFeedIconAndUpdateFeed(feed, readerConn, iconConn) {
  const lookupURLObject = createFeedIconLookupURL(feed);
  if(!lookupURLObject) {
    return false;
  }

  let maxAgeMillis, fetchHTMLTimeoutMillis, fetchImageTimeoutMillis,
    minImageByteSize, maxImageByteSize;
  const verbose = false;// TODO: get from param

  const iconURLString = await lookupFavicon(iconConn, lookupURLObject,
    maxAgeMillis, fetchHTMLTimeoutMillis, fetchImageTimeoutMillis,
    minImageByteSize, maxImageByteSize, verbose);
  if(!iconURLString) {
    return false;
  }

  // When the feed is missing an icon, then we want to set it.
  // When the feed is not missing an icon, then we only want to set it if the
  // newly found icon is different than the current icon.
  if(feed.faviconURLString === iconURLString) {
    return false;
  }

  if(verbose) {
    console.log('Changing feed icon url from %s to %s', feed.faviconURLString,
      iconURLString);
  }

  // Otherwise the icon changed, or the feed was missing an icon
  feed.faviconURLString = iconURLString;
  feed.dateUpdated = new Date();
  await putFeedInDb(readerConn, feed);
  return true;
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

} // End file block scope
