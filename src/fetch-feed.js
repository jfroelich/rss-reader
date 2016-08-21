// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const ACCEPT_XML = [
  'application/rss+xml',
  'application/rdf+xml',
  'application/atom+xml',
  'application/xml;q=0.9',
  'text/xml;q=0.8'
].join(', ');

// Fetches the xml file at the given url and calls back with an event object
// with props feed and entries. The feed is a Feed object and entries is an
// array of Entry objects.
// Internally this uses the new Fetch api so as to avoid sending cookies,
// because it is impossible to avoid sending cookies using XMLHttpRequest
// without some extravagant hack.
// @param request_url {URL} the url of the feed to fetch
// @param timeout_ms {number} optional timeout (not implemented)
// @param exclude_entries {boolean} whether to parse entry data
// @param callback {function} called when fetch completes
this.fetch_feed = function(request_url, timeout_ms, exclude_entries, callback) {

  console.assert(
    Object.prototype.toString.call(request_url) === '[object URL]');
  if(timeout_ms) {
    console.warn('timeout not supported');
    console.assert(!isNaN(timeout_ms));
    console.assert(isFinite(timeout_ms));
    console.assert(timeout_ms > 0);
  }

  console.debug('GET', request_url.href);

  const opts = {};
  opts.credentials = 'omit'; // no cookies
  opts.method = 'GET';
  opts.headers = {'Accept': ACCEPT_XML};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';
  let terminal_url_string, last_modified_string;

  let didCallback = false;

  function doCallback(event) {
    if(didCallback) {
      console.warn('Suppressing duplicated callback', request_url.href, event);
      return;
    }
    didCallback = true;
    callback(event);
  }

  // I guess then is always called, i need to somehow reject instead of
  // just return, something like that. But i can't quite tell how to do that
  // in the fetch api. basically there is no way to early exit if i use
  // an external then. So I have to always do another nested then with a
  // new promise. I need to use response.body.then(...) inside the
  // on_response function.

  let onResponseCalledBack = false;

  fetch(request_url.href, opts).then(function on_response(response) {
    if(!response.ok) {
      console.warn(request_url.href, response.status);
      onResponseCalledBack = true;
      return doCallback({'type': 'network_error'});
    }

    const type = response.headers.get('Content-Type');
    if(!type || !type.toLowerCase().includes('xml')) {
      console.warn(request_url.href, 'invalid type', type);
      onResponseCalledBack = true;
      return doCallback({'type': 'invalid_mime_type'});
    }

    // Not using response.redirected because it doesn't appear to work
    terminal_url_string = response.url;
    last_modified_string = response.headers.get('Last-Modified');
    return response.text();
  }).then(function on_read_full_text_stream(text) {

    if(onResponseCalledBack) {
      console.warn('on response already did a callback, exiting');
      return;
    }

    if(!text) {
      return doCallback({'type': 'empty_text_error'});
    }

    let parse_event = null;
    try {
      const document = parse_xml(text);
      parse_event = parse_feed(document, exclude_entries);
    } catch(error) {
      return doCallback({'type': 'parse_exception'});
    }

    const feed = parse_event.feed;
    console.assert(parse_event.entries);
    feed.add_url(request_url);
    if(terminal_url_string) {
      feed.add_url(new URL(terminal_url_string));
    }
    feed.dateFetched = new Date();
    if(last_modified_string) {
      try {
        feed.dateLastModified = new Date(last_modified_string);
      } catch(error) {
      }
    }

    doCallback({
      'type': 'success',
      'feed': feed,
      'entries': parse_event.entries
    });
  }).catch(function(error) {
    console.warn(error);
    doCallback({'type': 'unknown_error'});
  });
};

} // End file block scope
