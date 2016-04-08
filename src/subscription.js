// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Subscription-related functions
// Requires: /src/badge.js
// Requires: /src/db.js

// Unsubscribes from a feed.
// TODO: track the number of entries removed?
// TODO: use a single transaction?
// TODO: use an error object instead of an object literal? SubscriptionEvent
// TODO: should this be using non-nested functions or does that just cause
// tedium.
// TODO: should this just make direct calls to the db instead of delegating
// to the functions in db.js? The functions in db.js are not really even
// used elsewhere. I suppose it depends on whether I want an abstraction
// around the storage component, or the idea of storage in general. There is
// also the notion of decoupling db.js from this, from removing it as a
// dependency. Maybe that is a good thing. Another thing is that there is
// already some tight coupling given how I do things like access indexeddb
// event properties.
// TODO: expose some more info about a connection error? What are the props to
// consider from the indexedDB event?
// TODO: once the feed is removed, send out a message notifying other views of
// the unsubscribe event. For example, this way the slides view can remove any
// currently visible articles that were removed.
// TODO: maybe this should not even callback? Maybe it should only send
// a cross-window message? Similar to window.postMessage. But why require
// the round trip when it is right there for the caller?
function unsubscribe(feedId, callback) {
  'use strict';

  db_open(on_open);

  function on_open(event) {

    if(event.type !== 'success') {
      const errorEvent = {
        'type': 'error',
        'message': 'Failed to connect to database',
        'feedId': feedId,
        'entriesRemoved': -1
      };

      callback(errorEvent);
      return;
    }

    const openRequest = event.target;
    const connection = openRequest.result;
    db_remove_entries_by_feed(connection, feedId, on_remove_entries);
  }

  function on_remove_entries(event) {
    db_remove_feed(connection, feedId, on_remove_feed);
  }

  function on_remove_feed(event) {

    badge_update_count(connection);

    const successEvent = {
      'type': 'success',
      'message': 'Successfully unsubscribed.',
      'feedId': feedId,
      'entriesRemoved': -1
    };

    callback(successEvent);
  }
}
