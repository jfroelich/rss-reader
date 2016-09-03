// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Gets the last url from the feed's urls. This expects that the feed always
// has at least one url.
// @param feed {Object} the feed object to inspect
// @return {String} a url string
function get_feed_url(feed) {
  console.assert(feed);
  console.assert(feed.urls);
  console.assert(feed.urls.length);
  return feed.urls[feed.urls.length - 1];
}

// Append the url to the feed
// @param feed {Object} the feed to modify
// @param url {string} the url to append
// @return {boolean} true if url appended
function append_feed_url(feed, url) {
  console.assert(feed);
  console.assert(url);

  // Lazily create the urls property
  if(!('urls' in feed)) {
    feed.urls = [];
  }

  // Before appending the url, check if it already exists. In order to do that,
  // we need to compare normalized urls. In order to do that, deserialize the
  // url string into a URL object, and then serialize the URL object back into
  // a string, and then apply any non-native normalizations.
  // It is the caller's responsibility here to provide a valid url.
  // This can throw but shouldn't.
  const url_obj = new URL(url);
  url_obj.hash = '';
  const normal_url = url_obj.href;

  // Assume that all urls from feed.urls are already normalized
  for(let feed_url of feed.urls) {
    if(feed_url === normal_url) {
      return false;
    }
  }

  feed.urls.push(normal_url);
  return true;
}

// Returns a new object that has been sanitized. This checks for invalid values
// and tries to minimize XSS vulnerables in html strings.
// This currently only does asserts in some cases, not actual validation.
function sanitize_feed(input_feed) {
  // Clone to maintain purity
  const feed = Object.assign({}, input_feed);

  // This is called for both feeds already added to the database and feeds not
  // yet added. Feeds that are not yet added do not have an id.
  // If id is defined it should be a positive integer
  if(feed.id) {
    console.assert(!isNaN(feed.id));
    console.assert(isFinite(feed.id));
    console.assert(feed.id > 0);
  }

  // If type is defined it should be one of the allowed types
  const types = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(feed.type) {
    console.assert(feed.type in types, 'invalid type', feed.type);
  }

  // Sanitize feed title. title is an HTML string
  if(feed.title) {
    let title = feed.title;
    title = filter_control_chars(title);
    title = replace_html(title, '');
    title = title.replace(/\s+/, ' ');
    title = truncate_html(title, 1024, '');
    title = title.trim();
    feed.title = title;
  }

  // Sanitize feed description. description is an HTML string
  if(feed.description) {
    let description = feed.description;
    description = filter_control_chars(description);
    description = replace_html(description, '');

    // Condense and transform whitespace into a single space
    description = description.replace(/\s+/, ' ');

    // Enforce a maximum storable length
    const pre_trunc_len = description.length;
    const DESCRIPTION_MAX_LENGTH = 1024 * 10;
    description = truncate_html(description, DESCRIPTION_MAX_LENGTH, '');
    if(pre_trunc_len > description.length) {
      console.warn('Truncated description', description);
    }

    description = description.trim();
    feed.description = description;
  }

  return feed;
}

{ // Begin update_feed block scope

// @param connection {IDBDatabase} an open database connection
// @param feed {Feed} the Feed instance to put into the database
// @param callback {function} optional callback function
function update_feed(db, feed, callback) {
  console.assert(feed);
  const feed_url = get_feed_url(feed);
  console.assert(feed_url);
  console.debug('Updating feed', feed_url);

  const sanitized_feed = sanitize_feed(feed);
  sanitized_feed.dateUpdated = new Date();
  const storable_feed = filter_undef_props(sanitized_feed);

  // Creating a new transaction can throw an exception if the database is in the
  // process of closing. That happens because of errors elsewhere in the code.
  // But those errors should not prevent update_feed from calling back with an
  // error. So catch the exception.
  let tx = null;
  try {
    tx = db.transaction('feed', 'readwrite');
  } catch(error) {
    console.error(storable_feed.urls, error);
    callback({'type': 'error', 'feed': feed, 'error': error});
    return;
  }

  const store = tx.objectStore('feed');
  const request = store.put(storable_feed);
  if(callback) {
    request.onsuccess = put_onsuccess.bind(request, callback, storable_feed);
    request.onerror = put_onerror.bind(request, callback, storable_feed);
  }
}

function put_onsuccess(callback, feed, event) {
  callback({'type': 'success', 'feed': feed});
}

function put_onerror(callback, feed, event) {
  console.error(event.target.error);
  callback({'type': 'error', 'feed': feed});
}

this.update_feed = update_feed;

} // End update_feed block scope

{ // Begin add_feed block scope

function add_feed(feed, callback) {
  console.assert(!feed.id);
  console.assert(feed.urls);
  console.assert(feed.urls.length);
  console.debug('Adding feed', get_feed_url(feed));
  const sanitized_feed = sanitize_feed(feed);
  sanitized_feed.dateCreated = new Date();
  const storable_feed = filter_undef_props(sanitized_feed);
  const transaction = this.db.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.add(storable_feed);
  if(callback) {
    request.onsuccess = add_onsuccess.bind(request, storable_feed, callback);
    request.onerror = add_onerror.bind(request, storable_feed, callback);
  }
}

function add_onsuccess(feed, callback, event) {
  const new_auto_incremented_id = event.target.result;
  feed.id = new_auto_incremented_id;
  callback({'type': 'success', 'feed': feed});
}

function add_onerror(feed, callback, event) {
  console.error(event.target.error);
  callback({'type': event.target.error.name});
}

this.add_feed = add_feed;

} // End add_feed block scope

// Returns a new object of the old feed merged with the new feed. Fields from
// the new feed take precedence, except for URLs, which are merged to generate
// a distinct ordered set of oldest to newest url.
function merge_feeds(old_feed, new_feed) {
  const merged_feed = Object.assign({}, old_feed, new_feed);

  // Re-merge the urls. Use spread operator to clone for purity.
  merged_feed.urls = [...old_feed.urls];
  for(let url of new_feed.urls) {
    append_feed_url(merged_feed, url);
  }

  return merged_feed;
}
