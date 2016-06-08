// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Feed routines
const Feed = {};

// TODO: check last modified date of the remote xml file to avoid
// pointless updates?
// TODO: ensure the date is not beyond the current date?
// TODO: maybe not modify date updated if not dirty
// TODO: sanitize html?
// TODO: rename original to originalFeed, and feed to newFeed
// NOTE: callback receives an event resulting from either request.onsuccess
// or onerror. Use event.target.result to get the new id in case event.type
// equals success.
Feed.put = function(connection, original, feed, callback) {

  // Create a storable object from the input feeds by combining together the
  // properties of original and feed into a basic object, and sanitizing
  // the properties of the storable object.

  // original represents the feed as it exists prior to this call, it is the
  // locally stored feed that was loaded and is going to be updated via
  // replacement.
  // original may be undefined when adding a new feed, so we have to
  // test whether it is defined when accessing it.

  const storable = {};

  // Only set the id if we are doing an update. If we are doing an add, the
  // id is automatically defined by indexedDB's autoincrement
  if(original) {
    storable.id = original.id;
  }

  // url is required so assume it exists
  // TODO: maybe this should not assume, it should test and throw?
  // TODO: this should test and throw
  // TODO: this should also not assume that url is trimmed
  // NOTE: this is used later to derive storable.schemeless
  storable.url = feed.url;

  // Store the fetched feed type (e.g. rss or rdf) as a string
  if('type' in feed) {
    storable.type = feed.type;
  }

  // TODO: instead of schemeless, I should be using a fully normalized url
  // for comparision. I should deprecate this property.

  // Derive and store the schemeless url of the feed, which is used to
  // check for dups
  if(original) {
    storable.schemeless = original.schemeless;
  } else {

    // TODO: I think filterProtocol can throw. I need to think about how
    // to deal with this expressly.

    storable.schemeless = utils.url.filterProtocol(storable.url);
  }

  const title = sanitizeBeforePut(feed.title);

  // NOTE: title is semi-required. It must be defined, although it can be
  // an empty string. It must be defined because of how views query and
  // iterate over the feeds in the store using title as an index. If it were
  // ever undefined those feeds would not appear in the title index.
  storable.title = title || '';

  const description = sanitizeBeforePut(feed.description);
  if(description) {
    storable.description = description;
  }

  const link = sanitizeBeforePut(feed.link);
  if(link) {
    storable.link = link;
  }

  // Even though date should always be set, this can work in the absence of
  // a value
  if(feed.date) {
    storable.date = feed.date;
  }

  // TODO: this property should be renamed so as to be consistent with the
  // names of other date properties
  // NOTE: this is set in fetchFeed to a Date object
  if(feed.fetchDate) {
    storable.fetchDate = feed.fetchDate;
  }

  // Set date created and date updated. We only modify date updated if we
  // are updating an existing feed. We don't set date updated for a new feed
  // because it has never been updated (note I am not sure if I like this).
  // TODO: use better names, like dateCreated, dateUpdated or dateModified
  // TODO: use Date objects instead of timestamps
  if(original) {
    storable.updated = Date.now();
    storable.created = original.created;
  } else {
    storable.created = Date.now();
  }

  // Put the feed into the feed store, and then callback.
  // TODO: maybe I don't need to wrap. Maybe onerror and onsucess should just
  // receive the idb event directly, and they can figure out how to check for
  // new id. This is at least one less function on the stack that is generally
  // otherwise pointless, and I don't think it is giving the caller too much
  // responsibility

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(storable);

  // NOTE: callback may be undefined, but that is ok
  // NOTE: we use request.onsuccess and onerror instead of
  // transaction.oncomplete because the feed's new id in the case of an add
  // is defined in event.target.result of onsuccess
  request.onsuccess = callback;
  request.onerror = callback;

  //request.onsuccess = function onSuccess(event) {
  //  const newId = event.target.result;
  //  callback(newId);
  //};
  //request.onerror = function onError(event) {
  //  callback();
  //};

  // Prep a string property of an object for storage in indexedDB
  function sanitizeBeforePut(value) {
    if(value) {
      value = HTMLUtils.replaceTags(value, '');
      value = utils.string.filterControlCharacters(value);
      value = value.replace(/\s+/, ' ');
      value = value.trim();
      return value;
    }
  }
};
