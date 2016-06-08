// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Create a storable object from the input feeds by combining together the
// properties of current and new feed into a basic object, and then
// sanitizing the properties of the storable feed, and then storing the
// storable feed, and then calling the callback.
// TODO: ensure the date is not beyond the current date?
// TODO: maybe do not modify date updated if no values changed
// TODO: think more about XSS and where I should be sanitizing these inputs,
// should it be the responsibility of render, or here before storage. There is
// an ambiguity then regarding the input formatting, I don't want to mistakenly
// re-encode encoded html entities and so forth. Maybe just using textContent
// instead of innerHTML in the render will ensure no problem.
function putFeed(connection, currentFeed, newFeed, callback) {
  const storable = {};

  // Only set the id if we are doing an update. If we are doing an add, the
  // id is automatically defined by indexedDB's autoincrement feature
  // Assume that if id is defined that it is valid.
  // Assume that if currentFeed is defined that id is defined.
  if(currentFeed) {
    storable.id = currentFeed.id;
  }

  // url is required so assume it exists
  // TODO: maybe this should not assume, it should test and throw?
  // TODO: this should test and throw
  // TODO: this should also not assume that url is trimmed
  // NOTE: this is used later to derive storable.schemeless
  // NOTE: i am using newFeed.url although technically this should be the
  // same thing as currentFeed.url because it is replacing it and it shouldn't
  // matter which one I use?
  storable.url = newFeed.url;

  // Store the fetched feed type (e.g. rss or rdf) as a string
  // Assume that if type is defined that it is valid
  if('type' in newFeed) {
    storable.type = newFeed.type;
  }

  // TODO: instead of schemeless, I should be using a fully normalized url
  // for comparison. I should deprecate this property.

  // Derive and store the schemeless url of the feed, which is used to
  // check for dups
  if(currentFeed) {
    storable.schemeless = currentFeed.schemeless;
  } else {

    // TODO: I think filterProtocol can throw. I need to think about how
    // to deal with this expressly.

    storable.schemeless = utils.url.filterProtocol(storable.url);
  }

  // NOTE: title is semi-required. It must be defined, although it can be
  // an empty string. It must be defined because of how views query and
  // iterate over the feeds in the store using title as an index. If it were
  // ever undefined those feeds would not appear in the title index.
  // TODO: remove this requirement somehow? Maybe the options page that
  // retrieves feeds has to manually sort them?
  const title = sanitizeBeforePut(newFeed.title);
  storable.title = title || '';

  const description = sanitizeBeforePut(newFeed.description);
  if(description) {
    storable.description = description;
  }

  const link = sanitizeBeforePut(newFeed.link);
  if(link) {
    storable.link = link;
  }

  // Even though date should always be set, this can work in the absence of
  // a value
  if(newFeed.date) {
    storable.date = newFeed.date;
  }

  // TODO: this property should be renamed so as to be consistent with the
  // names of other date properties
  // NOTE: this is set in fetchFeed to a Date object
  if(newFeed.fetchDate) {
    storable.fetchDate = newFeed.fetchDate;
  }

  // Set date created and date updated. We only modify date updated if we
  // are updating an existing feed. We don't set date updated for a new feed
  // because it has never been updated (note I am not sure if I like this).
  // TODO: use better names, like dateCreated, dateUpdated or dateModified
  // TODO: use Date objects instead of timestamps
  if(currentFeed) {
    storable.updated = Date.now();
    storable.created = currentFeed.created;
  } else {
    storable.created = Date.now();
  }

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(storable);

  // NOTE: callback may be undefined, but that is ok
  // NOTE: we use request.onsuccess and onerror instead of
  // transaction.oncomplete because the feed's new id in the case of an add
  // is defined in event.target.result of onsuccess
  request.onsuccess = callback;
  request.onerror = callback;

  // NOTE: if i switch back to these i have to allow for an undefined callback

  //request.onsuccess = function onPutSuccess(event) {
  //  const newId = event.target.result;
  //  callback(newId);
  //};
  //request.onerror = function onPutError(event) {
  //  callback();
  //};

  // Prep a string property of an object for storage in indexedDB
  function sanitizeBeforePut(inputString) {
    let outputString = null;
    if(inputString) {
      outputString = inputString;
      outputString = utils.string.filterControlCharacters(outputString);
      outputString = HTMLUtils.replaceTags(outputString, '');
      // Condense whitespace
      outputString = outputString.replace(/\s+/, ' ');
      outputString = outputString.trim();
    }
    return outputString;
  }
}
