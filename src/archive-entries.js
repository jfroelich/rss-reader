// See license.md

'use strict';


// Default to one day in millis
const archiveEntriesDefaultMaxAge = 1 * 24 * 60 * 60 * 1000;

async function archiveEntries(conn,
  maxAgeInMillis = archiveEntriesDefaultMaxAge, logObject) {

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
  const entryArray = await dbGetUnarchivedReadEntries(conn);

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
    const compactedEntryObject = archiveEntryObject(entryObject,
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
  const resolutionsArray = await dbPutEntries(conn, compactedEntriesArray);

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
  const channel = new BroadcastChannel('db');
  channel.postMessage(archiveMessage);
  channel.close();

  if(logObject) {
    logObject.log('Archive entries completed (loaded %d, compacted %d)',
      entryArray.length, compactedEntriesArray.length);
  }

  return compactedEntriesArray.length;
}

// Shallow copy certain properties into a new object
function archiveEntryObject(entryObject, archiveDate) {
  const compactedEntryObject = {};
  compactedEntryObject.dateCreated = entryObject.dateCreated;
  compactedEntryObject.dateRead = entryObject.dateRead;
  compactedEntryObject.feed = entryObject.feed;
  compactedEntryObject.id = entryObject.id;
  compactedEntryObject.readState = entryObject.readState;
  compactedEntryObject.urls = entryObject.urls;
  compactedEntryObject.archiveState = ENTRY_ARCHIVED_STATE;
  compactedEntryObject.dateArchived = archiveDate;
  return compactedEntryObject;
}
