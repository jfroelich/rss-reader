import assert from '/src/lib/assert.js';
import {NetworkError} from '/src/lib/better-fetch/better-fetch.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import {fetch_image} from '/src/lib/fetch-image.js';

export async function fetch_image_test() {
  let path = '/src/lib/fetch-image-test.png';
  let url_string = resolve_extension_path(path);
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
  path = '/src/lib/favicon/i-do-not-exist.png';
  url_string = resolve_extension_path(path);
  url = new URL(url_string);
  options = undefined;  // reset for isolation, presumably indefinite default
  let error404;
  try {
    response = await fetch_image(url, options);
  } catch (error) {
    error404 = error;
  }

  // Fetching a non-existent LOCAL image should have produced the correct error
  // NOTE: what happens is that better-fetch traps the native type error that
  // is thrown by the native fetch call, and translates this into a network
  // error type, as an attempt to produce a clearer error type. The native
  // fetch call does not produce a response that is later a 404 and therefore
  // a fetch error as one might expect, at least for loading a local file.
  // The point of all this is to be aware of the difference in behavior for
  // loading a local url vs a remote url. In the remote case, we could connect
  // to the server (no more network error), and then the server would respond
  // with a 404 response, which causes better-fetch to produce a FetchError.
  // We are basically not testing remote behavior, which is actually the typical
  // use case that we should be testing. But in order to do that I need to think
  // of the proper netiquette.
  assert(error404 instanceof NetworkError);
}

function resolve_extension_path(path) {
  return chrome.extension.getURL(path);
}
