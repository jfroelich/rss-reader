import assert from '/src/assert.js';
import * as net from '/src/net.js';

export async function fetch_image_test() {
  let path = '/src/test/fetch-image-test.png';
  let url_string = chrome.extension.getURL(path);
  let url = new URL(url_string);

  // Test without a timeout
  let options = {timeout: 0};
  let response = await net.fetch_image(url, options);
  assert(response);

  // Test with a timeout that should never happen
  options = {timeout: 100000};
  response = await net.fetch_image(url, options);
  assert(response);

  // Test against a non-existent image
  path = '/src/test/i-do-not-exist.png';
  url_string = chrome.extension.getURL(path);
  url = new URL(url_string);
  let error404;
  try {
    response = await net.fetch_image(url, options);
  } catch (error) {
    error404 = error;
  }
  // This should be the native error type thrown by native fetch call
  assert(error404 instanceof TypeError);
}

export async function better_fetch_test() {
  // TODO: implement me
}

export async function fetch_feed_test() {
  // TODO: implement me
}
// TODO: run on a local resource
// TODO: cannot accept param

export async function fetch_html_test() {
  // TODO: implement me
}

/*
async function fetch_html_test_old(url_string, timeout) {
  const request_url = new URL(url_string);
  const response = await net.fetch_html(request_url, {timeout: timeout});
  console.dir(response);
  const response_text = await response.text();
  console.log(response_text);
  return response;
}
*/
