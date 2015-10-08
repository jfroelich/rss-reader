// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.fetch = {};

/**
 * Fetches the XML for a feed, parses it into a javascript object, and passes
 * this along to a callback. If an error occurs along the way, calls the onerror
 * callback instead.
 *
 * TODO: standardize the error object passed to onerror
 * TODO: somehow store responseURL? intelligently react to redirects
 * TODO: remove duplicate entries?
 * TODO: make online check caller's responsibility?
 * TODO: change to use single callback, async.forEach style
 * TODO: should filtering and rewriting take place somewhere else?
 * TODO: maybe onError parameter should be required
 * TODO: maybe this should be a FeedRequest class?
 */
lucu.fetch.fetchFeed = function(url, onComplete, onError, timeout) {
  'use strict';

  onError = onError || lucu.fetch.onFetchErrorDefault;

  if(lucu.isOffline()) {
    onError({type: 'offline', url: url});
    return;
  }

  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = lucu.fetch.onRequestError.bind(request, onError);
  request.ontimeout = onError;
  request.onabort = onError;
  request.onload = lucu.fetch.onRequestLoad.bind(request, onComplete, onError);
  request.open('GET', url, true);
  request.overrideMimeType('application/xml');
  request.send();
};

lucu.fetch.onRequestLoad = function(callback, fallback, event) {
  'use strict';
  const document = event.target.responseXML;
  var error;

  if(!document || !document.documentElement) {
    error = {type: 'invalid-xml', target: this};
    fallback(error);
    return;
  }


  try {
    const feed = lucu.deserializeFeed(document);
    
    // NOTE: feed is const and therefore block scoped, therefore
    // the remaining statements must occur within the try block

    // Remove any entries without links as those cannot be stored
    feed.entries = feed.entries.filter(lucu.fetch.entryHasLink);
    // Rewrite the links of entries before passing along
    feed.entries = feed.entries.map(lucu.fetch.rewriteEntryLink);
    callback(feed);
  } catch(e) {
    error = {type: 'invalid-xml', target: this, details: e};
    fallback(error);
    return;
  }

  
};

lucu.fetch.entryHasLink = function(entry) {
  'use strict';
  return entry.link;
};

lucu.fetch.rewriteEntryLink = function(entry) {
  'use strict';
  entry.link = lucu.rewriteURL(entry.link);
  return entry;
};

lucu.fetch.onRequestError = function(callback, event) {
  'use strict';
  console.debug('fetch feed error');
  console.dir(event);
  callback(event);  
};

lucu.fetch.onFetchErrorDefault = function(errorEvent) {
  'use strict';
  console.dir(errorEvent);
};
