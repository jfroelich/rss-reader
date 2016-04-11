// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: move subscription related functionality from options.js to here.
// For example, create a subscribe function that passes a subscription event
// to its callback.

// Subscription-related functions
// Requires: /src/badge.js
// Requires: /src/db.js

// Unsubscribes from a feed. Removes any entries corresponding to the feed,
// removes the feed, and then calls the callback.
// @param feedId - integer
function unsubscribe(feedId, callback) {
  'use strict';

  // A shared state object used by continuations
  const state = {
    'feedId': feedId,
    'callback': callback,
    'connection': null,
    'entriesRemoved': 0
  };

  // Although I generally do not guard against invalid inputs, I do so here
  // because this could pretend to be successful otherwise.
  if(!feedId || isNaN(feedId)) {
    const subscriptionEvent = {
      'type': 'error',
      'subtype': 'invalid_id',
      'feedId': feedId,
      'entriesRemoved': state.entriesRemoved
    };
    callback(subscriptionEvent);
    return;
  }

  const boundOnOpen = unsubscribe_on_open.bind(null, state);
  db_open(boundOnOpen);
}

function unsubscribe_on_open(state, event) {
  'use strict';

  if(event.type !== 'success') {
    // TODO: expose some more info about a connection error? What are the
    // props to consider from the indexedDB event?
    const subscriptionEvent = {
      'type': 'error',
      'subtype': 'connection_error',
      'feedId': state.feedId,
      'entriesRemoved': state.entriesRemoved
    };

    state.callback(subscriptionEvent);
    return;
  }

  // TODO: use a single transaction for both removing entries and for
  // removing the feed? Maybe I should be opening the transaction
  // here on both stores, and then passing around the transaction, not the
  // the connection. Note that if I do this, I cannot use transaction.oncomplete
  // to forward. I have to forward only when cursor is undefined in the
  // iterating function. The question is, does it make sense to use a
  // single transaction or two transactions here? What is the point of a
  // transaction? Do I want this all to be able rollback? A similar strange
  // thing, is that if a rollback occurs, what does that mean to views that
  // already responded to early events sent in progress? In that case I can't
  // actually send out in progress events if I want to roll back properly.
  // The thing is, when would the transaction ever fail? Ever? And if it could
  // even fail, do I want to be deleting the feed or its entries first when
  // using two separate transactions or does the order not matter?

  const connectionRequest = event.target;
  const connection = connectionRequest.result;

  // TODO: connection may be implicitly available in the event object,
  // maybe I don't need it within state.
  state.connection = connection;
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = unsubscribe_on_remove_entries.bind(null, state);
  const store = transaction.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(id);
  request.onsuccess = unsubscribe_delete_next_entry.bind(null, state);
}

function unsubscribe_delete_next_entry(state, event) {
  'use strict';
  const request = event.target;
  const cursor = request.result;
  if(cursor) {
    const entry = cursor.value;
    const asyncDeleteEntryRequest = cursor.delete();
    state.entriesRemoved++;
    const entryDeletedMessage = {
      'type': 'entryDeleteRequestedByUnsubscribe',
      'entryId': entry.id
    };
    // NOTE: Ignores possible transaction rollback
    chrome.runtime.sendMessage(entryDeletedMessage);
    cursor.continue();
  }
}

function unsubscribe_on_remove_entries(state, event) {
  'use strict';
  // TODO: retreive connection from event instead of state.
  const connection = state.connection;
  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(id);
  const boundOnComplete = unsubscribe_on_complete.bind(null, state);
  request.onsuccess = boundOnComplete;
}

function unsubscribe_on_complete(state, event) {
  'use strict';

  // NOTE: This happens after because it is a separate read transaction,
  // despite pending delete requests of the previous transaction
  // TODO: retrieve connection from event instead of state
  badge_update_count(state.connection);

  const subscriptionEvent = {
    'type': 'success',
    'feedId': state.feedId,
    'entriesRemoved': state.entriesRemoved
  };
  state.callback(subscriptionEvent);
}
