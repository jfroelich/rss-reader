// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function unsubscribe(feedId, callback) {
  console.assert(feedId && !isNaN(feedId), 'invalid feed id', feedId);
  console.debug('Unsubscribing from feed with id', feedId);

  // Create a shared state for simple parameter passing to continuations
  const context = {
    'feedId': feedId,
    'deleteRequestCount': 0,
    'callback': callback
  };

  openIndexedDB(unsubscribeOnOpenDatabase.bind(null, context));
}

function unsubscribeOnOpenDatabase(context, connection) {
  if(connection) {
    context.connection = connection;
    // Open a cursor over the entries for the feed
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor(context.feedId);
    request.onsuccess = unsubscribeDeleteNextEntry.bind(request, context);
    request.onerror = unsubscribeDeleteNextEntry.bind(request, context);
  } else {
    unsubscribeOnComplete(context, 'ConnectionError');
  }
}

function unsubscribeDeleteNextEntry(context, event) {

  if(event.type === 'error') {
    console.error(event);
    unsubscribeOnComplete(context, 'DeleteEntryError');
    return;
  }

  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    // Delete the entry at the cursor (async)
    cursor.delete();
    // Track the number of delete requests
    context.deleteRequestCount++;

    // Async, notify interested 3rd parties the entry will be deleted
    chrome.runtime.sendMessage({
      'type': 'entryDeleteRequested',
      'entryId': entry.id
    });
    cursor.continue();
  } else {
    unsubscribeOnRemoveEntries(context);
  }
}

function unsubscribeOnRemoveEntries(context) {
  console.debug('Deleting feed with id', context.feedId);
  const transaction = context.connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(context.feedId);
  request.onsuccess = unsubscribeDeleteFeedOnSuccess.bind(request, context);
  request.onsuccess = unsubscribeDeleteFeedOnError.bind(request, context);
}

function unsubscribeDeleteFeedOnSuccess(context, event) {
  unsubscribeOnComplete(context, 'success');
}

function unsubscribeDeleteFeedOnError(context, event) {
  console.warn('Failed to delete feed with id %i, but may have deleted entries',
    context.feedId);
  unsubscribeOnComplete(context, 'DeleteFeedError');
}

function unsubscribeOnComplete(context, eventType) {
  // Connection may be undefined such as when calling this as a result of
  // failure to connect
  if(context.connection) {

    // If connected, check if we actually affected the entry store
    if(context.deleteRequestCount) {
      console.debug('Requested %i entries to be deleted',
        context.deleteRequestCount);

      // Even though the deletes are async, the readonly transaction in
      // badge.update waits for the pending deletes to complete
      badge.update(context.connection);
    }

    context.connection.close();
  }

  // Callback with an event
  if(context.callback) {
    context.callback({
      'type': eventType,
      'feedId': context.feedId,
      'deleteRequestCount': context.deleteRequestCount
    });
  }
}
