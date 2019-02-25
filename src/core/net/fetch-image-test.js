import {fetch_image} from '/src/core/net/fetch-image.js';
import {assert} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as platform from '/src/lib/platform.js';

export async function fetch_image_test() {
  let path = '/src/core/net/fetch-image-test.png';
  let url_string = platform.extension.get_url_string(path);
  let url = new URL(url_string);

  // Test using explicit indefiniteness
  let options = {timeout: INDEFINITE};
  let response = await fetch_image(url, options);
  assert(response);

  // Test with an explicit definite timeout that should never happen
  // in test context
  options = {timeout: new Deadline(100000)};
  response = await fetch_image(url, options);
  assert(response);

  // Test against a non-existent image
  path = '/src/core/net/i-do-not-exist.png';
  url_string = platform.extension.get_url_string(path);
  url = new URL(url_string);
  options = undefined;  // reset for isolation, presumably indefinite default
  let error404;
  try {
    response = await fetch_image(url, options);
  } catch (error) {
    error404 = error;
  }

  // The error should be the native error type thrown by native fetch call
  // and not unexpectedly one of the custom error types
  assert(error404 instanceof TypeError);
}
