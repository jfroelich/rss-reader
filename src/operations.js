// See license.md

'use strict';

const operations = {};

// Default to one day in millis
operations.archiveDefaultMaxAge = 1 * 24 * 60 * 60 * 1000;

operations.archiveEntries = async function(conn,
  maxAgeInMillis = operations.archiveDefaultMaxAge, logObject) {

  if(logObject) {
    logObject.log('Archiving entries older than %d ms', maxAgeInMillis);
  }

  if(!Number.isInteger(maxAgeInMillis)) {
    throw new TypeError(`Invalid maxAge: ${maxAgeInMillis}`);
  }

  if(maxAgeInMillis < 0) {
    throw new TypeError(`Invalid maxAge: ${maxAgeInMillis}`);
  }

  // Load all unarchived but read entry objects from the database into an array
  const entryArray = await db.getUnarchivedReadEntryArray(conn);

  if(logObject) {
    logObject.debug('Loaded %d entry objects from database', entryArray.length);
  }

  // Get a subset of archivable entries
  const archivableEntriesArray = [];
  const currentDate = new Date();
  for(let entryObject of entryArray) {
    const entryAgeInMillis = currentDate - entryObject.dateCreated;
    if(entryAgeInMillis > maxAgeInMillis) {
      archivableEntriesArray.push(entryObject);
    }
  }

  // Compact the archivable entries
  const compactedEntriesArray = new Array(archivableEntriesArray.length);
  for(let entryObject of archivableEntriesArray) {
    const compactedEntryObject = operations.archiveEntryObject(entryObject,
      currentDate);
    compactedEntriesArray.push(compactedEntryObject);
  }

  if(logObject) {
    for(let i = 0, length = archivableEntriesArray.length; i < length; i++) {
      const beforeSize = utils.sizeOf(archivableEntriesArray[i]);
      const afterSize = utils.sizeOf(compactedEntriesArray[i]);
      logObject.log(beforeSize, 'compacted to', afterSize);
    }
  }

  // Store the compacted entries, overwriting the old objects
  const resolutionsArray = await db.putEntries(conn, compactedEntriesArray);

  // Build an array of the ids of compacted entries
  const entryIdsArray = new Array(compactedEntriesArray);
  for(let entryObject of compactedEntriesArray) {
    entryIdsArray.push(entryObject.id);
  }

  // Create the message object that will be sent to observers
  const archiveMessage = {};
  archiveMessage.type = 'archivedEntries';
  archiveMessage.ids = entryIdsArray;

  // Broadcast the message in the db channel
  const dbChannel = new BroadcastChannel('db');
  dbChannel.postMessage(archiveMessage);
  dbChannel.close();

  if(logObject) {
    logObject.log('Archive entries completed (loaded %d, compacted %d)',
      entryArray.length, compactedEntriesArray.length);
  }

  return compactedEntriesArray.length;
}

// Shallow copy certain properties into a new object
operations.archiveEntryObject(entryObject, archiveDate) {
  const compactedEntryObject = {};
  compactedEntryObject.dateCreated = entryObject.dateCreated;
  compactedEntryObject.dateRead = entryObject.dateRead;
  compactedEntryObject.feed = entryObject.feed;
  compactedEntryObject.id = entryObject.id;
  compactedEntryObject.readState = entryObject.readState;
  compactedEntryObject.urls = entryObject.urls;
  compactedEntryObject.archiveState = entry.ARCHIVED_STATE;
  compactedEntryObject.dateArchived = archiveDate;
  return compactedEntryObject;
}


operations.markEntryRead = async function(conn, entryId) {

  if(!Number.isInteger(entryId) || entryId < 1) {
    throw new TypeError(`Invalid entry id ${entryId}`);
  }

  const entryObject = await db.findEntryByEntryId(conn, entryId);

  if(!entryObject) {
    throw new Error(`No entry found with id ${entryId}`);
  }

  if(entryObject.readState === entry.READ_STATE) {
    throw new Error(`Already read entry with id ${entryId}`);
  }

  entryObject.readState = entry.READ_STATE;
  entryObject.dateRead = new Date();

  // NOTE: this is currently redundant with db.putEntry internals. Whose
  // responsibility is it?
  entryObject.dateUpdated = new Date();

  await db.putEntry(conn, entryObject);
  await updateBadgeText(conn);
};

// TODO: this could be optimized to only load entries missing urls
operations.removeEntriesMissingURLs = async function(conn) {
  let dbChannel;
  let numRemoved = 0;
  try {

    // Load all entries
    const entryArray = await db.getEntryArray(conn);

    // Get an array of entries missing urls
    const invalidEntryArray = new Array(entryArray.length);
    for(let entryObject of entryArray) {
      if(!entryObject.urls) {
        invalidEntryArray.push(entryObject);
      } else if(!entryObject.urls.length) {
        invalidEntryArray.push(entryObject);
      }
    }

    // Get an array of entry ids to remove
    const entryIdArray = new Array(invalidEntryArray);
    for(let entryObject of invalidEntryArray) {
      entryIdArray.push(entryObject.id);
    }

    dbChannel = new BroadcastChannel('db');
    const resolutions = await db.removeEntriesWithIds(conn, entryIdArray, dbChannel);
    numRemoved = resolutions.length;
  } finally {
    if(dbChannel) {
      dbChannel.close();
    }
  }
  return numRemoved;
};


operations.removeOrphanedEntries = async function(conn) {
  let dbChannel;

  try {

    const feedIdArray = await db.getFeedIdArray(conn);
    const entryArray = await db.getEntryArray(conn);

    // Get an array of all entries missing a feed id or have a feed id that
    // does not exist in the set of current feed ids
    const orphanArray = new Array(entryArray.length);
    for(let entryObject of entryArray) {
      if(!entryObject.feed) {
        orphanArray.push(entryObject);
      } else if(!feedIdArray.includes(entryObject.feed)) {
        orphanArray.push(entryObject);
      }
    }

    // Get an id of entries to remove
    const idArray = new Array(orphanArray.length);
    for(let entryObject of orphanArray) {
      idArray.push(entryObject.id);
    }

    dbChannel = new BroadcastChannel('db');
    const resolutions = await db.removeEntriesWithIds(conn, idArray, dbChannel);

  } finally {
    if(dbChannel) {
      dbChannel.close();
    }
  }
};


operations.defaultSubscribeOptions = {
  'fetchFeedTimeoutMillis': 2000,
  'suppressNotifications': false
};

// Returns the feed that was added if successful
operations.subscribe = async function(dbConn, iconDbConn, feedObject,
  options = operations.defaultSubscribeOptions, logObject) {

  const urlString = feed.getURLString(feedObject);

  if(logObject) {
    logObject.log('Subscribing to feed with url', urlString);
  }

  const isExistingURL = await db.containsFeedURL(dbConn, urlString);
  if(isExistingURL) {
    if(logObject) {
      logObject.warn('Already subscribed to feed with url', urlString);
    }

    return;
  }

  // Offline subscription
  if('onLine' in navigator && !navigator.onLine) {
    if(logObject) {
      logObject.warn('Proceeding with offline subscription to', urlString);
    }

    const addedFeed = await db.addFeed(dbConn, feedObject);
    return addedFeed;
  }

  let remoteFeedObject;

  try {
    const fetchResultObject = await fetchFeed(urlString,
      options.fetchFeedTimeoutMillis);
    remoteFeedObject = fetchResultObject.feed;
  } catch(error) {
    if(logObject) {
      logObject.warn('Failed to subscribe due to fetch failure', urlString);
    }

    return;
  }

  // Check if redirect url exists
  const isRedirect = remoteFeedObject.urls.length > 1;
  if(isRedirect) {
    const redirectURLString = feed.getURLString(remoteFeedObject);
    const isExistingRedirectURL = await db.containsFeedURL(dbConn,
      redirectURLString);

    if(isExistingRedirectURL) {
      if(logObject) {
        logObject.warn('Already subscribed to feed with redirected url',
          redirectURLString);
      }

      return;
    }
  }

  const mergedFeedObject = feed.merge(feedObject, remoteFeedObject);
  await subscribeSetFeedFavicon(iconDbConn, mergedFeedObject, logObject);
  const addedFeed = await db.addFeed(dbConn, mergedFeedObject);

  if(!options.suppressNotifications) {
    subscribeShowNotification(addedFeed);
  }

  return addedFeed;
}

// TODO: below is not refactored


// TODO: need to update all uses of SubscriptionService
// - the params changed
// - also for unsubscribe




async subscribeSetFeedFavicon(iconDbConn, feedObject, logObject) {
  const lookupURLObject = jrFeedIconGetLookupURL(feedObject);

  // Lookup errors are not fatal so suppress any exceptions
  // TODO: should that be caller's responsibility?
  try {
    const iconURLString = await jrFaviconLookup(iconDbConn, lookupURLObject);
    feedObject.faviconURLString = iconURLString;
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }
  }
}

function subscribeShowNotification(feedObject) {
  const title = 'Subscription complete';
  const feedName = feedObject.title || feed.getURLString(feedObject);
  const message = 'Subscribed to ' + feedName;
  showNotification(title, message, feedObject.faviconURLString);
}



// Removes a feed and all of its associated entries from the database.
operations.unsubscribe = async function(dbConn, feedId, logObject) {
  if(logObject) {
    logObject.log('Unsubscribing from feed', feedId);
  }

  // It is reasonable to guard here because if feedId is a string, then the db
  // queries will still operate without an error but will not actually do
  // what is expected
  if(!Number.isInteger(feedId) || feedId < 1) {
    throw new TypeError(`Invalid feed id ${feedId}`);
  }

  const dbChannel = new BroadcastChannel('db');
  let entryIdsArray;
  let removePromise;

  // There is no catch block here because I want exceptions to bubble
  try {

    // Create a transaction that will be shared for the purposes of loading
    // entries, removing entries, and removing the feed
    const tx = dbConn.transaction(['feed', 'entry'], 'readwrite');

    entryIdsArray = await db.getEntryIdsByFeedId(tx, feedId);

    // TODO: this should be a call to a db function like
    // dbRemoveEntriesByFeed
    // Create, execute, and append a remove entry promise for each entry
    const removePromises = new Array(entryIdsArray.length);
    for(let entryId of entryIdsArray) {
      removePromise = db.removeEntryByEntryId(tx, entryId, dbChannel);
      removePromises.push(removePromise);
    }

    // Create, execute, and append a remove feed promise
    removePromise = db.removeFeed(tx, feedId);
    removePromises.push(removePromise);

    // Wait for all of the remove promises to complete, in any order
    const removeResolutions = await Promise.all(removePromises);
  } finally {

    // Ensure that the broadcast channel is closed
    dbChannel.close();
  }

  if(logObject) {
    logObject.debug('Unsubscribed from feed id', feedId);
    logObject.debug('Deleted %d entries', entryIdsArray.length);
  }

  // Upon removing all of the entries, we may have removed some unread entries,
  // in which case the badge is out of date, so request the unread number to
  // be counted again and displayed
  updateBadgeText(dbConn);

  // Return the number of entries removed (assuming no errors)
  return entryIdsArray.length;
}
