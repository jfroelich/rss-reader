// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: Use iife

'use strict';

var lucu = lucu || {};

lucu.feed = lucu.feed || {};


/**
 * Fetches the XML for a feed from a URL, then parses it into
 * a javascript object, and passes this along to a callback. If an error
 * occurs along the way, calls an error callback instead. Async.
 *
 * For each entry, if augmentEntries is true, and if the entry has
 * a link, this also sends subsequent http requests to get the full html
 * of the link and uses that instead of the entry.content property that
 * was provided from within the xml feed.
 *
 * TODO: onerror could be passed an XMLHttpRequest event containing an error,
 * an exception, a string, or a custom object. I need to standardize the
 * error object that is passed to onerror. I also think it really does
 * need error codes because identifying each error by string key is making
 * it difficult to respond to different errors differently.
 * TODO: this should not also do the xml to feed conversion? The coupling is
 * too tight because I want to be able to test fetching and transformation
 * separately. but separate web page fetching requires the feed be
 * converted first to identify links. Maybe what I am saying is I want
 * fetching to only be about fetching, and some more abstract controller
 * does the sequential cohesion by composing fetch+convert
 * TODO: is an approach that uses overrideMimeType better than
 * checking content type? will it just cause the native parsing errors I
 * was trying to avoid?
 * TODO: responseURL contains the redirected URL. Need to update the url
 * when that happens. Maybe I need to be storing both urls in the db.
 * TODO: entryTimeout should maybe be deprecated? Where should it really
 * be coming from?
 *
 * @param params {object} an object literal that should contain props:
 * - url the remote url of the feed to fetch
 * - oncomplete - a callback to call when the feed is fetched, that is passed
 * a javascript object representing the contents of the feed
 * - onerror - a callback to call in case of an error, that is called instead
 * of oncomplete
 * - timeout - optional timeout before giving up on feed
 * - augmentEntries - if true, fetches full content of entry.link and
 * uses that instead of the feed content
 * - entryTimeout - optional timeout before giving up on fetching webpage for entry
 */
lucu.feed.fetch = function(params) {

  // NOTE: augmentEntries has to exist as a paramter because
  // we we want to augment in a poll update context but do not
  // want to augment in a subscribe preview context.

  // NOTE: now that I think about it, the reason augmentEntries exists
  // is because fetch.js is doing two things instead of one thing. I should
  // never haved mixed together the augmentEntry code with the fetch code.
  // The caller can easily just pass the result of fetch to augmentEntries
  // using two function calls. Calling only fetch is the equivalent of
  // passing in augmentEntries:false.
  // As a result of the above change, it should cut this file size in half
  // and move all the augment code into its own file.
  // It would move the entryTimeout function out of here as well.
  // It would make the number of arguments small enough to go back to using
  // basic explicit arguments

  // A part of the above involves the 'url exists' check. I really don't
  // like how this queries the storage.  Id rather have the caller do
  // some kind of array.filter(async method) that passes in just those
  // distinct entries to fetch. Something like that at least

  var url = (params.url || '').trim();
  var noop = function(){};
  var oncomplete = params.oncomplete || noop;
  var onerror = params.onerror || noop;
  var timeout = params.timeout;
  var augmentEntries = params.augmentEntries;
  var entryTimeout = params.entryTimeout;

  // For some unexpected reason this function is sometimes
  // called when offline so we need to check for that here
  // and exit early. This avoids a bunch of net::ERR_NETWORK_IO_SUSPENDED
  // error messages produced by request.send.
  // request.send() does not appear to throw a catchable exception.

  // NOTE: still getting this error. It is like onLine is not returning
  // false when offline.

  // NOTE: should this be the caller's responsibility? It seems kind of
  // strange to be able to call a 'fetch' operation while offline

  if(!navigator.onLine) {
    return onerror({type: 'offline', url: url});
  }

  // TODO: use new fetchHTML

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;
  request.onload = lucu.feed.onFetch.bind(request, oncomplete,
    onerror, augmentEntries, entryTimeout);
  request.open('GET', url, true);
  request.send();
};

lucu.feed.onFetch = function(onComplete, onError, shouldAugmentEntries,
  entryTimeout) {

  var getMimeType = function(request) {
    return request && request.getResponseHeader('Content-Type');
  };

  var isMimeFeed = function(contentType) {
    return /(application|text)\/(atom|rdf|rss)?\+?xml/i.test(contentType);
  };

  var mime = getMimeType(this) || '';


  if(isMimeFeed(mime)) {
    if(!this.responseXML || !this.responseXML.documentElement) {
      return onError({type: 'invalid-xml', target: this});
    }

    return lucu.feed.convertFromXML(this.responseXML, onComplete, onError,
      shouldAugmentEntries, entryTimeout);
  }

  lucu.isTextHTMLOrPlain = function(s) {
    return /text\/html|plain/i.test(s);
  };

  if(lucu.isTextHTMLOrPlain(mime)) {

    try {
      var xmlDocument = lucu.parseXML(this.responseText);
    } catch(e) {
      return onError(e);
    }

    if(!xmlDocument || !xmlDocument.documentElement) {
      return onError({type: 'invalid-xml', target: this});
    }

    return lucu.feed.convertFromXML(xmlDocument, onComplete, onError,
      shouldAugmentEntries, entryTimeout);
  }

  return onError({type: 'invalid-content-type', target: this});
};

lucu.feed.convertFromXML = function(xmlDocument, onComplete, onError,
  shouldAugmentEntries, entryTimeout) {
  var feed;
  try {
    feed = deserializeFeed(xmlDocument);
  } catch(deserializationError) {
    return onError({type: 'invalid-xml', details: deserializationError});
  }

  if(!feed.entries.length) {
    return onComplete(feed);
  }

  var entries = feed.entries || [];
  var fetchableEntries = entries.filter(function (entry) {
    return entry.link;
  });

  var numEntriesToProcess = fetchableEntries.length;
  if(numEntriesToProcess == 0) {
    return onComplete(feed);
  }

  fetchableEntries.forEach(lucu.entry.rewriteLink);

  // TODO: this is around the critical break in the data flow
  // where augmenting entries (and images and so forth) should
  // occur in a separate module

  if(!shouldAugmentEntries) {
    return onComplete(feed);
  }

  var dispatchIfComplete = function() {
    numEntriesToProcess--;
    if(numEntriesToProcess) return;
    onComplete(feed);
  };

  // TODO: this lookup check should be per feed, not across all feeds,
  // otherwise if two feeds link to the same article, only the first gets
  // augmented. need to use something like findEntryByFeedIdAndLinkURL
  // that uses a composite index

  // TODO: technically I should be opening a conn per lookup because
  // there is no guarantee db conn remains open on long http request

  var onFetchHTML = function (entry, doc, responseURL) {
    lucu.fetchImageDimensions(doc, function() {
      var html = doc.body.innerHTML;

      if(html) {
        entry.content = html;
      } else {
        entry.content = 'Unable to download content for this article';
      }

      dispatchIfComplete();
    });
  };

  lucu.database.open(function(db) {
    fetchableEntries.forEach(function(entry) {
      lucu.entry.findByLink(db, entry.link, function(exists) {
        if(exists) {
          dispatchIfComplete();
          return;
        }
        lucu.fetchHTML(entry.link, entryTimeout,
          onFetchHTML.bind(null, entry), dispatchIfComplete);
      });
    });
  });
};
