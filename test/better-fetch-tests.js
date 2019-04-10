import assert from '/lib/assert.js';
import {better_fetch} from '/lib/better-fetch.js';
import {NetworkError} from '/lib/better-fetch.js';
import {AcceptError} from '/lib/better-fetch.js';

export async function better_fetch_ordinary_test() {
  // Exercise an ordinary case of the function on a local file and assert that
  // it basically runs without error.
  const path = '/test/better-fetch-test.html';
  const url_string = chrome.extension.getURL(path);
  const url = new URL(url_string);
  const response = await better_fetch(url);

  const full_text = await response.text();
  assert(full_text === 'Hello World\n', full_text);
}

// Verify that fetching a file of a particular type along with a response type
// constraint on that type succeeds
export async function better_fetch_good_type_test() {
  const path = '/test/better-fetch-test.html';
  const url_string = chrome.extension.getURL(path);
  const url = new URL(url_string);

  const options = {};
  options.types = ['text/html'];

  const response = await better_fetch(url, options);
}

// Verify that fetching with a response type constraint that does not allow for
// the given type produces the expected error
export async function better_fetch_bad_type_test() {
  const path = '/test/better-fetch-test.html';
  const url_string = chrome.extension.getURL(path);
  const url = new URL(url_string);

  const options = {};
  options.types = ['text/plain'];

  let response;
  let fetch_error;
  try {
    response = await better_fetch(url, options);
  } catch (error) {
    fetch_error = error;
  }

  assert(fetch_error instanceof AcceptError);
}

// Verify that fetching a local file that does not exist produces a network
// error
export async function better_fetch_local_404_test() {
  const path = '/src/lib/this-file-does-not-exist.html';
  const url_string = chrome.extension.getURL(path);
  const url = new URL(url_string);

  let response;
  let fetch_error;

  try {
    response = await better_fetch(url);
  } catch (error) {
    fetch_error = error;
  }

  assert(fetch_error instanceof NetworkError);
}
