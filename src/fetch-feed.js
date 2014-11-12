// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * TODO: use overrideMimeType and simply allow the native mechanism
 * to trigger invalid content type errors
 * TODO: fetchFullArticles should not be a parameter and should not occur
 * here. Use the new lucu.augmentEntryContent function.
 * TODO: lucu.augmentEntryContent no longer avoids fetching the html
 * for entries that already exist in the database. So now we need
 * another separate function that filters out entries from the feed
 * that already exist.
 * TODO: entryTimeout is now a parameter to augmentEntryContent
 * so it does not need to be here
 * TODO: note that lucu.augmentEntryContent operates off the array
 * of entries, not the original feed
 * TODO: pass responseURL back to onComplete so that caller can
 * react to redirects?
 *
 *
 * Fetches the XML for a feed from a URL, then parses it into
 * a javascript object, and passes this along to a callback. If an error
 * occurs along the way, calls an error callback instead. Async.
 *
 * For each entry, if fetchFullArticles is true, and if the entry has
 * a link, this also sends subsequent http requests to get the full html
 * of the link and uses that instead of the entry.content property that
 * was provided from within the xml feed.
 *
 * TODO: onError could be passed an XMLHttpRequest event containing an error,
 * an exception, a string, or a custom object. I need to standardize the
 * error object that is passed to onError. I also think it really does
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
 * TODO: request.responseURL contains the redirected URL. Need to update the url
 * when that happens. Maybe I need to be storing both urls in the db?
 * TODO: entryTimeout should maybe be deprecated? Where should it really
 * be coming from?
 *
 * TODO: rather than call onerror, throw exception?
 *
 * @param params {object} an object literal that should contain props:
 * - url the remote url of the feed to fetch
 * - oncomplete - a callback to call when the feed is fetched, that is passed
 * a javascript object representing the contents of the feed
 * - onerror - a callback to call in case of an error, that is called instead
 * of oncomplete
 * - timeout - optional timeout before giving up on feed
 * - fetchFullArticles - if true, fetches full content of entry.link and
 * uses that instead of the feed content
 * - entryTimeout - optional timeout before giving up on fetching webpage for entry
 */
lucu.fetchFeed = function(params) {
  'use strict';

  // TODO: once I move out the augment code, change params back to explicit
  // arguments

  // NOTE: fetchFullArticles exists because fetch is doing two things instead
  // of one. I should never haved mixed together the augmentEntry code with
  // the fetch code. The caller can easily just pass the result of fetch to
  // fetchFullArticles using two function calls.

  var url = (params.url || '').trim();
  var noop = function(){};
  var onComplete = params.oncomplete || noop;
  var onError = params.onerror || noop;
  var timeout = params.timeout;

  // TODO: deprecate these once moved out of here
  var fetchFullArticles = params.fetchFullArticles;
  var entryTimeout = params.entryTimeout;

  // TODO: should this be the caller's responsibility? It seems kind of
  // strange to be able to call a 'fetch' operation while offline
  if(navigator && !navigator.onLine) {
    return onError({type: 'offline', url: url});
  }

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onError;
  request.ontimeout = onError;
  request.onabort = onError;
  request.onload = function() {
    var mime = this.getResponseHeader('Content-Type');
    var xmlDocument = null;

    var RE_FEED_TYPE = /(application|text)\/(atom|rdf|rss)?\+?xml/i;
    var RE_HTML_TYPE = /text\/html|plain/i;

    if(RE_FEED_TYPE.test(mime)) {
      xmlDocument = this.responseXML;
    } else if(RE_HTML_TYPE.test(mime)) {
      // Fallback
      try {
        xmlDocument = lucu.parseXML(this.responseText);
      } catch(e) {
        return onError(e);
      }
    } else {
      return onError({type:'invalid-content-type', target: this});
    }

    if(!xmlDocument || !xmlDocument.documentElement) {
      return onError({type: 'invalid-xml', target: this});
    }

    // TODO: why catch the exception here? Shouldn't this
    // just allow the exception to bubble through?

    try {
      var feed = lucu.deserializeFeed(xmlDocument);
    } catch(e) {
      return onError({type: 'invalid-xml', target: this, details: e});
    }

    // TODO: if we require entries to have links in order to store them,
    // should we explicitly filter out entries without links here?
    // not filter into fetchable, filter as in remove from the feed as if
    // they did ont exist? Or is that coupling in logic that is not innate?

    // really, we should always rewrite, or never rewrite, or store both
    // original and post-rewrite in separate props.

    // if we _always_ rewrite then coupling is fine. maybe do not
    // even need separate rewrite module


    var entries = feed.entries || [];

    if(!entries.length) {
      return onComplete(feed);
    }

    var fetchableEntries = entries.filter(function (entry) {
      return entry.link;
    });

    var numEntriesToProcess = fetchableEntries.length;
    if(!numEntriesToProcess) {
      return onComplete(feed);
    }

    fetchableEntries.forEach(function(entry) {
      entry.link = lucu.rewriteURL(entry.link);
    });

    if(!fetchFullArticles) {
      return onComplete(feed);
    }

    function dispatchIfComplete() {
      numEntriesToProcess--;
      if(numEntriesToProcess) return;
      onComplete(feed);
    }

    // TODO: this lookup check should be per feed, not across all feeds,
    // otherwise if two feeds link to the same article, only the first gets
    // augmented. need to use something like findEntryByFeedIdAndLinkURL
    // that uses a composite index

    // TODO: I should be opening a conn per lookup because
    // there is no guarantee db conn remains open on long http request

    // TODO: the logic for whether to update feels like it should not
    // involve db query, or at least, somehow it is out of place

    function onFetchHTML(entry, doc, responseURL) {

      lucu.resolveElements(doc, responseURL);

      // TODO: externalize host document somehow
      var hostDocument = window.document;

      var images = doc.body.getElementsByTagName('img');
      lucu.asyncForEach(images,
        lucu.fetchImageDimensions.bind(this, hostDocument),
        function() {
        var html = doc.body.innerHTML;
        entry.content = html ? html :
          'Unable to download content for this article';
        dispatchIfComplete();
      });

    }

/*
    lucu.filterExistingEntries(fetchableEntries, function(newEntries) {
      var entryCounter = newEntries.length;

      // Exit early when there are no new entries
      if(!entryCounter) {

      }


      newEntries.forEach(function(entry) {

        // entryCounter--;
      });
    });
*/

    // TODO: react to connection error/blocked
    // TODO: use asyncForEach

    var openRequest = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
    openRequest.onerror = console.error;
    openRequest.onblocked = console.error;
    openRequest.onsuccess = function (event) {
      var db = event.target.result;
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
    };

  };

  request.open('GET', url, true);
  request.send();
};
