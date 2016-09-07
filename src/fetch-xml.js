// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const ACCEPT_XML_HEADER_VALUE = [
  'application/rss+xml',
  'application/rdf+xml',
  'application/atom+xml',
  'application/xml;q=0.9',
  'text/xml;q=0.8'
].join(', ');

// TODO: the bug I've avoided with the hack is the extra callbacks. The 'then'
// to read the text is always called, even when i don't want it to be.
// I need to somehow reject instead of just return, something like that. But
// I can't quite tell how to do that
// in the fetch api. basically there is no way to early exit if i use
// an external then. So I have to always do another nested then with a
// new promise. I need to use response.body.then(...) inside the
// on_response function.

// Fetches the xml file at the given url and calls back with an event object
// @param request_url {URL} the url of the feed to fetch
// @param callback {function} called when fetch completes
this.fetch_xml = function(request_url, callback) {

  // These dependencies only appear in a try/catch, so I am explicitly
  // asserting them, because otherwise the result looks like a parse exception
  // and not a static error. I do not assert them until within this function,
  // as a global assert could be evaluated before the other files were loaded
  console.assert(parse_xml);

  // Should always be called with a URL object
  console.assert(is_url_object(request_url));

  // Callback is required
  console.assert(callback);

  console.debug('GET', request_url.href);

  // Setup the fetch options
  const opts = {};
  // Using 'omit' is the only way to send a request without the Cookie header,
  // it cannot be done with XMLHttpRequest, and is the whole reason I am using
  // the fetch api.
  opts.credentials = 'omit';
  opts.method = 'GET';
  opts.headers = {'Accept': ACCEPT_XML_HEADER_VALUE};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';
  let terminal_url_string;
  let did_callback = false;
  let on_response_called_back = false;
  let response_content_type = null;
  let last_modified_date = null;
  let last_modified_string = null;

  function do_callback(event) {
    if(did_callback) {
      console.warn('Suppressing duplicated callback', request_url.href, event);
      return;
    }
    did_callback = true;
    callback(event);
  }

  fetch(request_url.href, opts).then(function on_response(response) {
    if(!response.ok) {
      console.warn(request_url.href, response.status);
      on_response_called_back = true;
      return do_callback({
        'type': 'network_error',
        'status': response.status
      });
    }

    const content_type = response.headers.get('Content-Type');
    if(!is_acceptable_content_type(content_type)) {
      console.warn(request_url.href, 'invalid type', content_type);
      on_response_called_back = true;
      return do_callback({
        'type': 'invalid_mime_type',
        'content_type': content_type
      });
    }

    // NOTE: tentatively always setting response url, may deprecate did_redirect
    //if(did_redirect(request_url, response)) {
      terminal_url_string = response.url;
    //}

    last_modified_string = response.headers.get('Last-Modified');

    // Fallback to using the Date field
    // TODO: not sure if this is right, testing
    if(!last_modified_string) {
      last_modified_string = response.headers.get('Date');
    }

    if(last_modified_string) {
      try {
        last_modified_date = new Date(last_modified_string);
      } catch(error) {
        console.warn(error);
      }
    }

    return response.text();
  }).then(function on_read_full_text_stream(text) {

    // Part of the hack with exiting a promise early
    if(on_response_called_back) {
      console.warn('on response already did a callback, exiting');
      return;
    }

    // Parse the text into a Document object
    let document = null;
    try {
      document = parse_xml(text);
    } catch(error) {
      console.warn(error);
      return do_callback({
        'type': 'parse_exception',
        'error_object': error,
        'response_text': text
      });
    }

    const successEvent = {
      'type': 'success',
      'document': document,
      'response_url_string': terminal_url_string,
      'last_modified_date': last_modified_date
    };
    do_callback(successEvent);
  }).catch(function(error) {
    console.warn(error);
    do_callback({
      'type': 'unknown_error'
    });
  });
};

// Checks the request header value and returns true if xml or html
// @param type {String} the raw header string for 'Content-Type'
function is_acceptable_content_type(type) {

  // Treat missing content type as unacceptable
  if(!type) {
    return false;
  }

  // The header value may contain the charset. So use a general includes
  // condition that tolerates its presence.
  // Restrict to xml. However, support an html fallback for cases where the
  // server responded with the incorrect mime type.
  const lc_type = type.toLowerCase();
  if(lc_type.includes('xml')) {
    return true;
  } else if(lc_type.includes('text/html')) {
    return true;
  }

  return false;
}

function is_url_object(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}

// Returns true if a redirect occurred.
// @param request_url {URL} - the starting url
// @param response {Response} - the response object produced by calling fetch
function did_redirect(request_url, response) {
  console.assert(request_url);
  console.assert(response);

  // Assume that response.url is always defined (and valid)
  console.assert(response.url);

  // response.redirected does not seem to be set correctly in Chrome 52. So
  // as a work around, I am testing whether the response url is different than
  // the request url. I have to convert response url to a URL object in order
  // to normalize it, because I am not sure whether Chrome does this for me.

  const response_url = new URL(response.url);

  // We cannot compare URL objects using the exact equality operator, so compare
  // the string forms of both urls.
  // Note that I am not doing any additional normalization, like filtering the
  // hash from each url. It turns out that frequently I do see a redirect occur
  // merely because the fetch api strips the hash from the request url in
  // creating the response url, even though no redirect occurred. However, this
  // can still be considered a redirect (for now).
  // The reason that I allow this inaccuracy for now is because of external
  // knowledge that this will be called by fetch_feed, which will append the
  // url to the feed object using append_feed_url, which will recognize that
  // the new url is not different than the old one when not considering the
  // hash, and therefore silently ignore it. I don't love this but this is how
  // it is working for now.
  // TODO: perhaps I should be filtering the hash before calling fetch for this
  // reason? I think fetch implicitly does this for me, because of how the
  // HTTP protocol works, a GET request is against a path, its hash value is
  // irrelevant? The thing is, where would I strip? There is no need to strip
  // here because its implicitly done by fetch. However, there is a need to
  // strip the hash somewhere earlier, because it messes up this condition
  // Maybe the better approach is to just output the response url and not care
  // about redirect logic here, and let the caller do comparisons

  return request_url.href !== response_url.href;
}

} // End file block scope
