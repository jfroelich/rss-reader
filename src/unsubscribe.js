// See license.md

'use strict';

// Removes a feed and all of its associated entries from the database.
async unsubscribe(dbConn, feedId, logObject) {
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

    entryIdsArray = await dbGetEntryIdsByFeedId(tx, feedId);

    // TODO: this should be a call to a db function like
    // dbRemoveEntriesByFeed
    // Create, execute, and append a remove entry promise for each entry
    const removePromises = new Array(entryIdsArray.length);
    for(let entryId of entryIdsArray) {
      removePromise = dbRemoveEntry(tx, entryId, dbChannel);
      removePromises.push(removePromise);
    }

    // Create, execute, and append a remove feed promise
    removePromise = dbRemoveFeed(tx, feedId);
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
