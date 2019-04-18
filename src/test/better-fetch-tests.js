import { AcceptError, NetworkError, betterFetch } from '/src/lib/better-fetch.js';
import TestRegistry from '/src/test/test-registry.js';
import assert from '/src/lib/assert.js';

async function betterFetchOrdinaryTest() {
  // Exercise an ordinary case of the function on a local file and assert that it basically runs
  // without error.
  const path = '/src/test/better-fetch-test.html';
  const urlString = chrome.extension.getURL(path);
  const url = new URL(urlString);
  const response = await betterFetch(url);

  const fullText = await response.text();
  assert(fullText === 'Hello World\n', fullText);
}

// Verify that fetching a file of a particular type along with a response type constraint on that
// type succeeds
async function betterFetchGoodTypeTest() {
  const path = '/src/test/better-fetch-test.html';
  const urlString = chrome.extension.getURL(path);
  const url = new URL(urlString);

  const options = {};
  options.types = ['text/html'];

  await betterFetch(url, options);
}

// Verify that fetching with a response type constraint that does not allow for the given type
// produces the expected error
async function betterFetchBadTypeTest() {
  const path = '/src/test/better-fetch-test.html';
  const urlString = chrome.extension.getURL(path);
  const url = new URL(urlString);

  const options = {};
  options.types = ['text/plain'];

  let fetchError;
  try {
    await betterFetch(url, options);
  } catch (error) {
    fetchError = error;
  }

  assert(fetchError instanceof AcceptError);
}

// Verify that fetching a local file that does not exist produces a network error
async function betterFetchLocal404Test() {
  const path = '/src/src/lib/this-file-does-not-exist.html';
  const urlString = chrome.extension.getURL(path);
  const url = new URL(urlString);

  let fetchError;

  try {
    await betterFetch(url);
  } catch (error) {
    fetchError = error;
  }

  assert(fetchError instanceof NetworkError);
}

TestRegistry.registerTest(betterFetchOrdinaryTest);
TestRegistry.registerTest(betterFetchGoodTypeTest);
TestRegistry.registerTest(betterFetchBadTypeTest);
TestRegistry.registerTest(betterFetchLocal404Test);
