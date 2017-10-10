
/*
# Research 406

Debug line printed as result of calling fetch_html: Response not ok
http://daringfireball.net/linked/2016/10/31/intel-mbp-ram 406 Not Acceptable.
This also occurred in line 345 in favicon.js.

This messages shows up in the console when visiting the page:

A Parser-blocking, cross-origin script, http://connect.decknetwork.net/deckDF_js.php?1477969301611, is invoked via document.write. This may be blocked by the browser if the device has poor network connectivity. See https://www.chromestatus.com/feature/5718547946799104
for more details. (anonymous) @ intel-mbp-ram:112

The site is using a file name mint.js, and mint.js has some funky document.write stuff.
This is on Chrome 55, which I believe just mentioned something about this happening.
I am on broadband.
*/


(function(exports) {
'use strict';

async function fetch_html(url_string, timeout_ms) {
  const options = {
    'credentials': 'omit',
    'method': 'get',
    'headers': {'Accept': 'text/html'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer',
    'referrerPolicy': 'no-referrer'
  };

  const fetch_promise = fetch(url_string, options);
  let response;
  if(timeout_ms) {
    const timeout_promise = reject_after_timeout(url_string, timeout_ms);
    const promises = [fetch_promise, timeout_promise];
    response = await Promise.race(promises);
  } else
    response = await fetch_promise;

  validate_response(response, url_string);
  validate_content_type(response, url_string);

  const output_response = {};
  output_response.requestURLString = url_string;
  output_response.responseURLString = response.url;
  output_response.redirected = detect_redirect(url_string, response.url);
  output_response.text = async function() {
    return await response.text();
  };
  return output_response;
}

function reject_after_timeout(url_string, timeout_ms) {
  function resolver(resolve, reject) {
    const error = new Error(`Request timed out ${url_string}`);
    setTimeout(reject, timeout_ms, error);
  }
  return new Promise(resolver);
}

// TODO: inline, use asserts or something, do not report error in template
function validate_response(response, url_string) {
  if(!response)
    throw new Error(`${response.status} ${response.statusText} ${url_string}`);
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url_string}`);
  const no_content_http_status = 204;
  if(response.status === no_content_http_status)
    throw new Error(`${response.status} ${response.statusText} ${url_string}`);
}

function detect_redirect(request_url_string, response_url_string) {
  if(request_url_string === response_url_string)
    return false;
  const request_url_object = new URL(request_url_string);
  const response_url_object = new URL(response_url_string);
  request_url_object.hash = '';
  response_url_object.hash = '';
  return request_url_object.href !== response_url_object.href;
}

// TODO: do not throw, use ASSERT(response_is_valid_type) or something,
// move to repsonse.js
function validate_content_type(response, url_string) {
  let type_string = response.headers.get('Content-Type');
  if(!type_string)
    return;
  const semicolon_position = type_string.indexOf(';');
  if(semicolon_position !== -1)
    type_string = type_string.substring(0, semicolon_position);
  type_string = type_string.replace(/\s+/g, '');
  type_string = type_string.toLowerCase();
  const accepted_types = ['text/html'];
  if(!accepted_types.includes(type_string))
    throw new Error(`Unacceptable content type ${type_string} ${url_string}`);
}

exports.fetch_html = fetch_html;

}(this));
