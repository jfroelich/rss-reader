import {assert} from '/src/assert.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import * as net from '/src/net.js';

export async function fetch_image_test() {
  let path = '/src/test/fetch-image-test.png';
  let url_string = chrome.extension.getURL(path);
  let url = new URL(url_string);

  // Test using explicit indefiniteness
  let options = {timeout: INDEFINITE};
  let response = await net.fetch_image(url, options);
  assert(response);

  // Test with an explicit definite timeout that should never happen
  // in test context
  options = {timeout: new Deadline(100000)};
  response = await net.fetch_image(url, options);
  assert(response);

  // Test against a non-existent image
  path = '/src/test/i-do-not-exist.png';
  url_string = chrome.extension.getURL(path);
  url = new URL(url_string);
  options = undefined;  // reset for isolation, presumably indefinite default
  let error404;
  try {
    response = await net.fetch_image(url, options);
  } catch (error) {
    error404 = error;
  }

  // The error should be the native error type thrown by native fetch call
  // and not unexpectedly one of the custom error types
  assert(error404 instanceof TypeError);
}

export async function better_fetch_test() {
  // TODO: implement me
}

export async function fetch_feed_test() {
  // TODO: implement me
}

export async function fetch_html_test() {
  // TODO: run on a local resource
  // TODO: cannot accept param
  // TODO: assert something, do not just log
  // TODO: implement me

  // OLD:
  // let url_string = undefined;
  // let timeout = undefined;
  // const request_url = new URL(url_string);
  // const response = await net.fetch_html(request_url, {timeout: timeout});
  // console.dir(response);
  // const response_text = await response.text();
  // console.log(response_text);
  // return response;
}
