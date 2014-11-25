// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

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
 */
lucu.fetchFeed = function(url, onComplete, onError, timeout) {
  'use strict';

  onError = onError || function (event) {
    console.dir(event);
  };

  if(navigator && !navigator.onLine) {
    return onError({type: 'offline', url: url});
  }

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = function(event) {
    console.debug('fetch feed error');
    console.dir(event);
    onError(event);
  };
  request.ontimeout = onError;
  request.onabort = onError;
  request.onload = function () {
    var document = this.responseXML;
    if(!document || !document.documentElement) {
      return onError({type: 'invalid-xml', target: this});
    }

    try {
      var feed = lucu.deserializeFeed(document);
    } catch(e) {
      return onError({type: 'invalid-xml', target: this, details: e});
    }

    feed.entries = feed.entries.filter(function (entry) {
      return entry.link;
    }).map(function (entry) {
      entry.link = lucu.rewriteURL(entry.link);
      return entry;
    });

    onComplete(feed);
  };

  request.open('GET', url, true);
  request.overrideMimeType('application/xml');
  request.send();
};
