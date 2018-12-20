import assert from '/src/assert.js';

// TODO: the errors used by this class should be sourced from some lower
// level shared fetch errors library

// TODO: avoid sending cookies, probably need to use fetch api and give up on
// using the simple element.src trick, it looks like HTMLImageElement does not
// allow me to control the request parameters and does send cookies, but I need
// to review this more, I am still unsure.

// @param url {URL}
// @param timeout {Number}
// @param is_allowed_request {Function} optional, is given a request-like
// object, throws a policy error if the function returns false
export async function fetch_image_element(url, timeout = 0,
  is_allowed_request) {
  assert(url instanceof URL);

  const request_data = {method: 'GET', url: url};
  if (is_allowed_request && !is_allowed_request(request_data)) {
    throw new PolicyError('Refused to fetch ' + url.href);
  }

  const fpromise = fetch_image_element_promise(url);
  const contestants = timeout ? [fpromise, sleep(timeout)] : [fpromise];
  const image = await Promise.race(contestants);

  // Image is undefined when sleep won
  if (!image) {
    throw new TimeoutError('Timed out fetching ' + url.href);
  }

  return image;
}

// Return a promise that resolves to an image element. The image is loaded by
// proxy, which in other words means that we use a new, separate image element
// attached to the same document executing this function to load the image. The
// resulting image is NOT attached to the document that contained the image that
// had the given url. The proxy is used because we cannot reliably load images
// using the HTMLImageElement src setter method if we do not know for certain
// whether the document is live or inert. Documents created by DOMParser and
// XMLHttpRequest are inert. In an inert document the src setter method does not
// work.
function fetch_image_element_promise(url, is_allowed_request) {
  return new Promise((resolve, reject) => {
    const proxy = new Image();
    proxy.src = url.href;

    // If cached then resolve immediately
    if (proxy.complete) {
      resolve(proxy);
      return;
    }

    proxy.onload = _ => resolve(proxy);

    // The error event does not contain any useful error information so create
    // our own error. Also, we create a specific error type so as to distinguish
    // this kind of error from programmer errors or other kinds of fetch errors.
    const error = new FetchError('Fetch image error ' + url.href);
    proxy.onerror = _ => reject(error);
  });
}

// Return true if the error is a kind of temporary fetch error that is not
// indicative of a programming error
export function is_ephemeral_fetch_error(error) {
  return error instanceof FetchError || error instanceof PolicyError ||
      error instanceof TimeoutError;
}

// This error indicates a fetch operation failed for some reason like network
// unavailable, url could not be reached, etc
export class FetchError extends Error {
  constructor(message = 'Failed to fetch') {
    super(message);
  }
}

// This error indicates a resource cannot be fetched because something about the
// http request violates the app's policy. The caller defines the policy so this
// is all relative to the caller policy. An example policy violation might be
// that the policy only allows HTTPS requests but an HTTP request was made.
export class PolicyError extends Error {
  constructor(message = 'Refused to fetch url due to policy') {
    super(message);
  }
}

// This error indicates a fetch operation took too long
export class TimeoutError extends Error {
  constructor(message = 'Failed to fetch due to timeout') {
    super(message);
  }
}

// Returns a promise that resolves to undefined after a given amount of
// milliseconds.
function sleep(ms = 0) {
  assert(Number.isInteger(ms) && ms >= 0);
  return new Promise(resolve => setTimeout(resolve, ms));
}
