// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.xml = {};

// Parses the given xml string into a Document object. Throws an exception if a
// parsing error occurs
rdr.xml.parse = function(inputString) {

  if(typeof inputString !== 'string') {
    throw new Error('invalid inputString param: ' + inputString);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(inputString, 'application/xml');

  if(!doc) {
    throw new Error('parseFromString did not produce a document');
  }

  if(!doc.documentElement) {
    throw new Error('doc is missing documentElement');
  }

  const error = doc.querySelector('parsererror');
  if(error) {
    throw new Error(error.textContent);
  }

  return doc;
};

rdr.xml.acceptHeader = [
  'application/rss+xml',
  'application/rdf+xml',
  'application/atom+xml',
  'application/xml;q=0.9',
  'text/xml;q=0.8'
].join(', ');

// Fetches the xml file at the given url and calls back with an event object
// @param requestURL {URL} the url of the feed to fetch
// @param callback {function} called when fetch completes
// TODO: the bug I've avoided with the hack is the extra callbacks. The 'then'
// to read the text is always called, even when i don't want it to be.
// I need to somehow reject instead of just return, something like that. But
// I can't quite tell how to do that
// in the fetch api. basically there is no way to early exit if i use
// an external then. So I have to always do another nested then with a
// new promise. I need to use response.body.then(...) inside the
// onResponse function.
rdr.xml.fetch = function(requestURL, callback, verbose) {
  if(!rdr.utils.isURLObject(requestURL)) {
    throw new TypeError('requestURL must be a URL');
  }

  if(verbose) {
    console.debug('GET', requestURL.href);
  }

  const opts = {};
  // Using 'omit' is the whole reason this uses the Fetch api
  opts.credentials = 'omit';
  opts.method = 'GET';
  opts.headers = {'Accept': rdr.xml.acceptHeader};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';
  let terminalURLString;
  let didCallback = false;
  let onResponseCalledBack = false;
  let responseContentType = null;
  let lastModifiedDate = null;
  let lastModifiedString = null;

  function doCallback(event) {
    if(didCallback) {
      console.warn('Suppressing duplicated callback', requestURL.href, event);
      return;
    }
    didCallback = true;
    callback(event);
  }

  fetch(requestURL.href, opts).then(function onResponse(response) {
    if(!response.ok) {
      console.warn(requestURL.href, response.status);
      onResponseCalledBack = true;
      return doCallback({
        'type': 'network_error',
        'status': response.status
      });
    }

    const contentType = response.headers.get('Content-Type');
    if(!rdr.xml.isAcceptedType(contentType)) {
      console.warn(requestURL.href, 'invalid type', contentType);
      onResponseCalledBack = true;
      return doCallback({
        'type': 'InvalidMimeType',
        'contentType': contentType
      });
    }

    terminalURLString = response.url;
    lastModifiedString = response.headers.get('Last-Modified');
    if(lastModifiedString) {
      try {
        lastModifiedDate = new Date(lastModifiedString);
      } catch(error) {
        console.warn(error);
      }
    }

    return response.text();
  }).then(function onReadFullTextStream(text) {

    // Part of the hack with exiting a promise early
    if(onResponseCalledBack) {
      console.warn('on response already did a callback, exiting');
      return;
    }

    // Parse the text into a Document object
    const parse = rdr.xml.parse;
    let document = null;
    try {
      document = parse(text);
    } catch(error) {
      console.warn(error);
      return doCallback({
        'type': 'parse_exception',
        'error_object': error,
        'response_text': text
      });
    }

    const successEvent = {
      'type': 'success',
      'document': document,
      'responseURLString': terminalURLString,
      'lastModifiedDate': lastModifiedDate
    };
    doCallback(successEvent);
  }).catch(function(error) {
    // If lost net, this shows up as a TypeError
    // with message like TypeError: Failed to fetch <url>
    console.warn(error, requestURL.href);
    doCallback({
      'type': 'unknown_error'
    });
  });
};

// Checks the request header value and returns true if xml or html
// @param type {String} the raw header string for 'Content-Type'
rdr.xml.isAcceptedType = function(type) {
  // Treat missing content type as unacceptable
  if(!type) {
    return false;
  }

  // The header value may contain the charset so use a more general test.
  // Restrict to xml but allow for html for non-conforming responses
  const lcType = type.toLowerCase();
  if(lcType.includes('xml')) {
    return true;
  } else if(lcType.includes('text/html')) {
    return true;
  }

  return false;
};
