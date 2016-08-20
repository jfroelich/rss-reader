// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Fetches the xml file at the given url and calls back with an event object
// with props feed and entries, feed is a Feed object and entries is an array
// of Entry objects.
// Uses the fetch api so as to avoid sending cookies, because it is impossible
// to avoid sending cookies using XMLHttpRequest without some extravagant hack.
this.fetch_feed = function(request_url, timeout_ms, exclude_entries, callback) {

  // Partially validate function parameters
  console.assert(
    Object.prototype.toString.call(request_url) === '[object URL]');
  if(timeout_ms) {
    console.warn('The timeout parameter is not currently supported');
    console.assert(!isNaN(timeout_ms));
    console.assert(isFinite(timeout_ms));
    console.assert(timeout_ms > 0);
  }

  console.debug('GET', request_url.href);

  // Start by properly building the init parameter to the Request constructor
  const opts = {};

  // https://developer.mozilla.org/en-US/docs/Web/API/Request/Request states
  // that the default is actually not omit. "In Chrome the default
  // is 'same-origin' before Chrome 47 and 'include' starting with Chrome 47"
  // omit is needed to avoid sending the Cookie header.
  // It is not possible to avoid cookies using XMLHttpRequest
  opts.credentials = 'omit';

  // This is the default but I want to be explicit
  opts.method = 'GET';

  // Restrict the content type to xml by setting the Accept header
  const headers = new Headers();
  headers.set('Accept', 'application/rss+xml, application/rdf+xml, ' +
    'application/atom+xml, application/xml;q=0.9, text/xml;q=0.8');
  opts.headers = headers;

  // https://developer.mozilla.org/en-US/docs/Web/API/Request/Request provides
  // that before Chrome 47 the default is 'no-cors' and after the default is
  // 'same-origin'. I belive we are doing a cross origin request here so I
  // believe the value I want is cors.
  // TODO: test the effect of the other values
  opts.mode = 'cors';

  // Use default cache settings. Let the browser take care of caching requests
  // for xml files. I poll frequently, and I'd rather hit the cache instead of
  // bombarding the server.
  opts.cache = 'default';

  // According to the docs, "In Chrome the default is follow before Chrome 47
  // and manual starting with Chrome 47." Meaning I would have to follow such
  // things myself. I can still get at the response url by accessing
  // response.url in the resolved fetch
  opts.redirect = 'follow';

  // Avoid sending referrer information
  opts.referrer = 'no-referrer';

  // Because I can't figue out how to get at the response variable from the
  // then(text) part of this, I am cheating and using outer scope
  let redirect_url_string = null;
  let last_modified_string = null;

  // TODO: support timeout parameter. Turns out this is complicated.
  // Best thing I found was https://github.com/github/fetch/issues/175
  // It isn't great though. I am going to not timeout for now.

  // Execute the request
  fetch(request_url.href, opts).then(function(response) {
    console.assert(response);

    // Check for a network error
    // This is a boolean that checks if 200-299 status range
    // It is apparently still true for redirects too
    if(!response.ok) {
      console.warn(request_url.href, response.status, response.statusText);
      callback({
        'type': 'error_not_ok',
        'status': response.status,
        'statusText': response.statusText,
        'requestURL': request_url
      });
      return;
    }

    // Validate the content type header was set
    console.assert(response.headers);
    const type = response.headers.get('Content-Type');
    if(!type) {
      console.warn('Response missing Content-Type');
      callback({
        'type': 'error_no_type',
        'status': response.status,
        'statusText': response.statusText,
        'requestURL': request_url
      });
      return;
    }

    // Validate the content type header points to what looks like xml
    if(!type.toLowerCase().includes('xml')) {
      console.warn('Invalid Content-Type', type);
      callback({
        'type': 'error_invalid_type',
        'status': response.status,
        'statusText': response.statusText,
        'requestURL': request_url
      });
      return;
    }

    // Store the redirect for later
    // NOTE: response.redirected isn't working, so always store
    redirect_url_string = response.url;

    // Store the last modified header for later
    last_modified_string = response.headers.get('Last-Modified');

    // Return a promise and ask it to resolve and then when it resolves the
    // next then is called, or something like that??
    return response.text();
  }).then(function(text) {
    // The new fetch api does not provide a native equivalent of responseXML,
    // so manually parse the text into an XML document
    const parser = new DOMParser();
    let document = null;

    try {
      document = parser.parseFromString(text, 'application/xml');
    } catch(error) {
      console.warn(error.message);
      callback({
        'type': 'error_parse_exception',
        'requestURL': request_url
      });
      return;
    }

    console.assert(document);

    // Because I am using DOMParser and not the builtin responseXML property
    // of XMLHttpRequest, I have to account for the presence of embedded
    // parsing errors
    const embedded_error = document.querySelector('parsererror');
    if(embedded_error) {
      console.warn(request_url.href, embedded_error.textContent);
      callback({
        'type': 'error_embedded_parser_error',
        'requestURL': request_url
      });
      return;
    }

    // If we got this far we have a valid XML document. Now unmarshall it
    let parse_event = null;
    try {
      parse_event = parse_feed(document, exclude_entries);
    } catch(error) {
      console.warn(request_url.href, error.message);
      callback({
        'type': 'error_unmarshall_exception',
        'requestURL': request_url
      });
      return;
    }

    const feed = parse_event.feed;
    console.assert(parse_event.entries);

    // First add the request url, then the response url
    feed.add_url(request_url);

    if(redirect_url_string) {
      feed.add_url(new URL(redirect_url_string));
    }

    feed.dateFetched = new Date();

    if(last_modified_string) {
      try {
        feed.dateLastModified = new Date(last_modified_string);
      } catch(error) {
        console.warn(error);
      }
    }

    callback({
      'type': 'success',
      'feed': feed,
      'entries': parse_event.entries,
      'requestURL': request_url
    });
  }).catch(function(error) {
    console.error(error);
    callback({
      'type': 'error_unknown',
      'requestURL': request_url
    });
  });
};

} // End file block scope
