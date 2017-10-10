// HTTP response library

// Dependencies:
// assert.js

'use strict';

// Returns true if a response is valid (ok).
function response_is_valid(response) {
  // response should always be defined when calling this function.
  // TODO: make this check stricter and check type?
  ASSERT(response);

  // The spec says 204 is ok, because response.ok is true for status codes
  // 200-299, but I consider 204 to be an error.
  const HTTP_STATUS_NO_CONTENT = 204;
  return response.ok && response.status !== HTTP_STATUS_NO_CONTENT;
}


function response_get_last_modified_date(response) {
  ASSERT(response);

  const last_modified_string = response.headers.get('Last-Modified');
  if(!last_modified_string)
    return;

  try {
    return new Date(last_modified_string);
  } catch(error) {
  }
}


// Return true if the response url is 'different' than the request url, which
// indicates a redirect in the sense used by this library.
// Due to quirks with fetch response.redirected not working as expected. That
// may be just because I started using the new fetch API as soon as it
// became available and there was a bug that has since been fixed. I am talking
// about using response.redirected. When first using it I witnessed many times
// that it was false, even though a redirect occurred.
//
// TODO: given that it is not identical to the meaning of redirect in the
// spec, or that I am not really clear on it, maybe just be exact in naming.
// Maybe name the function something like response_is_new_url? Focusing only
// on how I use urls, instead of whatever a redirect technically is, may be
// a better way to frame the problem.
//
// @param request_url {String} the fetch input url
// @param response_url {String} the value of the response.url property of the
// Response object produced by calling fetch.

function response_is_redirect(request_url, response_url) {
  ASSERT(typeof request_url === 'string');

  // TODO: validate response_url? Is it required? I've forgotten.

  // If the two are exactly equal, then not a redirect. Even if some chain
  // of redirects occurred and the terminal url was the same as the initial
  // url, this is not a redirect.
  if(request_url === response_url)
    return false;

  // Note there are issues with this hashless comparison, when the '#' symbol
  // in the url carries additional meaning, such as when it used to indicate
  // '?'. If I recall this is a simple setting in Apache. I've witnessed it
  // in action at Google groups. Simply stripping the hash from the input
  // request url when fetching would lead to possibly fetching the wrong
  // response (which is how I learned about this, because fetches to Google
  // groups all failed in strange ways).

  // Normalize each url, and then compare the urls excluding the value of the
  // hash, if present. The response.url yielded by fetch discards this value,
  // leading to a url that is not exactly equal to the input url. This results
  // in something that appears to be a new url, that is in fact still the same
  // url, which means no redirect.

  // TODO: maybe this should be a call to a function in url.js, like
  // a url_ncmp kind of thing (similar to strncmp in c stdlib)

  const request_url_object = new URL(request_url);
  const response_url_object = new URL(response_url);
  request_url_object.hash = '';
  response_url_object.hash = '';
  return request_url_object.href !== response_url_object.href;
}

// Returns the mime type of the response
// @param response {Response}
// @returns {String} the mime type, normalized, or undefined if no type was
// found
function response_get_type(response) {
  ASSERT(response);
  let type_string = response.headers.get('Content-Type');
  if(!type_string)
    return;

  // TODO: this should be a call to a helper in mime.js
  // Strip the character encoding, if present. The substring gets all
  // characters up to but excluding the semicolon. I understand the coding
  // to be optional, so leave the type as is if no semicolon is present.
  const from_index = 0;
  const semicolon_position = type_string.indexOf(';');
  if(semicolon_position !== -1)
    type_string = type_string.substring(from_index, semicolon_position);

  // Normalize and return the type. The trim is implicit
  return string_remove_whitespace(type_string).toLowerCase();
}
