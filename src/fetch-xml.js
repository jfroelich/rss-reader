// See license.md

'use strict';

/*
TODO:
- use promises correctly
- no nested functions
- experiment with throwing errors in first promise, maybe this fixes the promise
issue
*/

{

function fetchXML(requestURL, log, callback) {

  if(!rdr.xml.parse) {
    throw new ReferenceError('missing dependency rdr.xml.parse');
  }

  log.log('GET', requestURL.toString());

  const accepts = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml;q=0.9',
    'text/xml;q=0.8'
  ].join(', ');

  // https://developer.mozilla.org/en-US/docs/Web/API/Request/Request

  const opts = {};
  opts.credentials = 'omit';// no cookies
  opts.method = 'GET';
  opts.headers = {'Accept': accepts};
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
      log.warn('Suppressing duplicated callback', requestURL.href, event);
      return;
    }
    didCallback = true;
    log.debug('callback event', event);
    callback(event);
  }

  fetch(requestURL.href, opts).then(function onResponse(response) {
    if(!response.ok) {
      log.warn(requestURL.href, response.status);
      onResponseCalledBack = true;
      return doCallback({
        'type': 'network_error',
        'status': response.status
      });
    }

    const contentType = response.headers.get('Content-Type');
    if(!isAcceptedType(contentType)) {
      log.warn(requestURL.href, 'invalid type', contentType);
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
  }).then(function(text) {
    log.debug('read in text of', requestURL.toString());

    // Part of the hack with exiting a promise early
    if(onResponseCalledBack) {
      log.warn('on response already did a callback, exiting');
      return;
    }

    // Parse the text into a Document object
    let document = null;
    try {
      document = rdr.xml.parse(text);
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
    log.warn(error, requestURL.href);
    doCallback({
      'type': 'unknown_error'
    });
  });
}

// Checks the request header value and returns true if xml or html
// @param type {String} the raw header string for 'Content-Type'
function isAcceptedType(type) {
  // Treat missing content type as unacceptable
  if(!type) {
    return false;
  }

  // The header value may contain the charset so use a more general test.
  // Restrict to xml but allow for html for non-conforming responses
  const str = type.toLowerCase();
  return str.includes('xml') || str.includes('text/html');
}

this.fetchXML = fetchXML;

}
