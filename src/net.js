// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/*
maybe make fetchDocument and merge fetchHTML and fetchFeed together, and
then move all of feed post-fetch processing into a separate function

- fetch feed notes
// TODO: the post-processing where i clean up entries should not be done here,
// it should be the caller's responsibility, it is not intrinsic to this
// function's purpose, improper separation of concerns
// TODO: the type of error passed back as first argument to the final callback
// should be consistent. Perhaps should mimic an event object and use that
// in all cases
// TODO: responseURL may be different than requested url, I observed this
// through logging, this should be handled here or by the caller somehow, right
// now this sets feed.url to requested url and just passes back responseURL
// as the third argument to the callback
-------

- fetch html notes
// TODO: what is the default behavior of XMLHttpRequest? If responseType
// defaults to document and by default fetches HTML, do we even need to
// specify the type?
// TODO: instead of creating an error object when document is undefined, maybe
// this should create an event object so that it is minimally consistent with
// the other types of the first argument when the callback is called due to
// another type of error. I could use a plain javascript object with just the
// desired relevant properties, or I could research how to create custom
// events.
*/

// Requires: /src/feed-parser.js

function net_fetch_feed(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = function on_error(event) {
    callback(event, null, request.responseURL);
  };

  request.ontimeout = function on_timeout(event) {
    callback(event, null, request.responseURL);
  };

  request.onabort = function on_abort(event) {
    callback(event, null, request.responseURL);
  };

  request.onload = function on_load(event) {
    const document = request.responseXML;

    if(!document) {
      callback(event, document, request.responseURL);
      return;
    }

    if(!document.documentElement) {
      callback(event, document, request.responseURL);
      return;
    }

    const parserError = document.querySelector('parsererror');
    if(parserError) {
      console.debug(parserError.outerHTML);
      parserError.remove();
    }

    let feed = null;
    try {
      feed = feed_parser_parse_document(document);
    } catch(exception) {
      callback(exception, null, request.responseURL);
      return;
    }

    feed.url = url;

    // TODO: look into the consistency of storing dates for other fields. I
    // think all fields should use the same convention. And I think that a
    // date should be a date. This might require several other changes.
    feed.fetchDate = new Date();

    // TODO: this post-processing may be outside the scope of this
    // functions responsibility

    // Filter empty links
    feed.entries = feed.entries.filter(function get_entry_link(entry) {
      return entry.link;
    });

    // Rewrite links
    feed.entries.forEach(function rewrite_entry_link(entry) {
      entry.link = utils.url.rewrite(entry.link);
    });

    // Remove duplicate entries by link
    const expandedEntries = feed.entries.map(function expand_entry(entry) {
      return [entry.link, entry];
    });
    const distinctEntriesMap = new Map(expandedEntries);
    feed.entries = Array.from(distinctEntriesMap.values());

    callback(null, feed, request.responseURL);
  };
  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
}

function net_fetch_html(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = function on_timeout(event) {
    callback(event, null, request.responseURL);
  };
  request.onerror = function on_error(event) {
    callback(event, null, request.responseURL);
  };
  request.onabort = function on_abort(event) {
    callback(event, null, request.responseURL);
  };
  request.onload = function on_load(event) {
    let error = null;
    const document = request.responseXML;
    if(!document) {
      error = new Error('Undefined document for url ' + url);
    } else if(!document.documentElement) {
      error = new Error('Undefined document element for url ' + url);
    }
    callback(error, document, request.responseURL);
  };
  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
}
