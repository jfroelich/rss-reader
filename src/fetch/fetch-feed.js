(function(exports) {
'use strict';

async function fetch_feed(url_string, timeout_ms, is_accept_html) {
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 0;
  if(typeof is_accept_html === 'undefined')
    is_accept_html = true;

  ASSERT(Number.isInteger(timeout_ms));
  ASSERT(timeout_ms >= 0);

  const acceptHeader = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml;q=0.9',
    'text/xml;q=0.8'
  ].join(',');

  const headers = {'Accept': acceptHeader};

  const options = {
    'credentials': 'omit',
    'method': 'get',
    'headers': headers,
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer',
    'referrerPolicy': 'no-referrer'
  };

  // TODO: if the non-timeout promise wins the race, cancel the timeout.

  const fetch_promise = fetch(url_string, options);
  let response;
  if(timeout_ms) {
    const error_message = 'Fetch timed out for url ' + url_string;
    const timeout_promise = reject_after_timeout(timeout_ms, error_message);
    const promises = [fetch_promise, timeout_promise];
    response = await Promise.race(promises);
  } else {
    response = await fetch_promise;
  }

  // TODO: use ASSERT, like ASSERT(response_is_valid);
  assert_response_valid(response, url_string);
  assert_response_type_valid(response, url_string, is_accept_html);

  const output_response = {};
  output_response.text = await response.text();
  output_response.requestURLString = url_string;
  output_response.responseURLString = response.url;
  output_response.lastModifiedDate = get_last_modified_date(response);
  output_response.redirected = detect_redirect(url_string, response.url);
  return output_response;
}

// Returns a promise that resolves to a setTimeout timer identifier
function reject_after_timeout(timeout_ms, error_message) {
  function executor(resolve, reject) {
    const error = new Error(error_message);
    return setTimeout(reject, timeout_ms, error);
  }
  return new Promise(executor);
}

// TODO: inline
// TODO: these should not be asserts because not violation of invariant
function assert_response_valid(response, url_string) {
  ASSERT(response);
  ASSERT(response.ok);
  const no_content_http_status = 204;
  ASSERT(response.status !== no_content_http_status);
}

// TODO: should not be an ASSERT because not a violation of an invariant.
// Instead this should nullify the response or something
// TODO: inline into caller, so it is more like
// ASSERT(response_has_valid_type)
// Throw an exception is the response type is not accepted
function assert_response_type_valid(response, url_string, allow_html) {
  let type_string = response.headers.get('Content-Type');
  if(!type_string)
    return;
  const semicolon_position = type_string.indexOf(';');
  if(semicolon_position !== -1)
    type_string = type_string.substring(0, semicolon_position);
  type_string = type_string.replace(/\s+/g, '');
  type_string = type_string.toLowerCase();

  const types = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml',
    'text/xml'
  ];
  if(allow_html)
    types.push('text/html');

  ASSERT(types.includes(type_string));
}

function get_last_modified_date(response) {
  const last_modified_string = response.headers.get('Last-Modified');
  if(last_modified_string)
    try {
      return new Date(last_modified_string);
    } catch(error) {
    }
}

// Due to quirks with fetch response.redirected not working, do a basic test
function detect_redirect(request_url_string, response_url_string) {
  if(request_url_string === response_url_string)
    return false;
  const request_url_object = new URL(request_url_string);
  const response_url_object = new URL(response_url_string);
  request_url_object.hash = '';
  response_url_object.hash = '';
  return request_url_object.href !== response_url_object.href;
}

exports.fetch_feed = fetch_feed;

}(this));
