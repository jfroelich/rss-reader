// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// @param connection {IDBDatabase} an open database connection
// @param feed {Feed} the Feed instance to put into the database
// @param callback {function} optional callback function
this.update_feed = function(connection, feed, callback) {
  console.assert(feed);
  console.assert(feed.get_url());
  console.debug('Updating feed', feed.get_url().toString());

  let sanitized_feed = sanitize_feed(feed);
  sanitized_feed.dateUpdated = new Date();
  let serialized_feed = serialize_feed(sanitized_feed);

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(serialized_feed);

  if(callback) {
    // TODO: pass back the sanitized object, not the serialized object?
    request.onsuccess = on_put_success.bind(request, callback, serialized_feed);
    request.onerror = on_put_error.bind(request, callback, serialized_feed);
  }
};

function on_put_success(callback, feed, event) {
  callback({'type': 'success', 'feed': feed});
}

function on_put_error(callback, feed, event) {
  console.error(event.target.error);
  callback({'type': 'error', 'feed': feed});
}

} // End file block scope
