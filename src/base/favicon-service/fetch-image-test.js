import assert from '/src/base/assert.js';
import {fetch_image} from '/src/base/favicon-service/fetch-image.js';

export async function fetch_image_test() {
  let path = '/src/base/favicon-service/fetch-image-test.png';
  let url_string = chrome.extension.getURL(path);
  let url = new URL(url_string);

  // Test without a timeout
  let options = {timeout: 0};
  let response = await fetch_image(url, options);
  assert(response);

  // Test with a timeout that should never happen
  options = {timeout: 100000};
  response = await fetch_image(url, options);
  assert(response);

  // TODO: Test with a timeout that should happen? How do I force it? Cache
  // issues?

  // options = {timeout: 1};
  // try {
  //  response = await fetch_image(url, options);
  // } catch(error) {
  // }

  // Test against a non-existent image
  path = '/src/base/favicon-service/i-do-not-exist.png';
  url_string = chrome.extension.getURL(path);
  url = new URL(url_string);
  let error404;
  try {
    response = await fetch_image(url, options);
  } catch (error) {
    error404 = error;
  }
  // This should be the native error type thrown by native fetch call
  assert(error404 instanceof TypeError);


  // TODO: test against non-image

  // TODO: test with bad timeout parameter
}
