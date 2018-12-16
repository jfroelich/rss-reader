import assert from '/src/assert.js';
import * as url_utils from '/src/url-utils/url-utils.js';

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this attempts to infer the
// dimensions for each image and modifies each image element's attributes.
export async function image_size_filter(document, timeout, is_allowed_request) {
  if (!document.baseURI) {
    throw new TypeError('document missing baseURI');
  }

  if (!document.body) {
    return;
  }

  const images = document.body.getElementsByTagName('img');
  const promises = [];
  for (const image of images) {
    promises.push(get_image_dims(image, timeout, is_allowed_request));
  }
  const results = await Promise.all(promises);

  for (const result of results) {
    if (result.width && result.height) {
      result.image.setAttribute('width', result.width);
      result.image.setAttribute('height', result.height);
    }
  }
}

function find_attribute_dimensions(image) {
  const dimensions = {width: 0, height: 0};
  if (image.hasAttribute('width')) {
    dimensions.width = image.width;
  }

  if (image.hasAttribute('height')) {
    dimensions.height = image.height;
  }

  return dimensions;
}

// Finds the dimensions of an image. This first looks at information that is
// available within the document, and if that fails, then fallsback to doing
// a network request.
async function get_image_dims(image, timeout, is_allowed_request) {
  const attr_dimensions = find_attribute_dimensions(image);
  if (attr_dimensions.width && attr_dimensions.height) {
    return {
      image: image,
      reason: 'attributes',
      width: attr_dimensions.width,
      height: attr_dimensions.height
    };
  }

  const style_dimensions = find_style_dimensions(image);
  if (style_dimensions.width && style_dimensions.height) {
    return {
      image: image,
      reason: 'style',
      width: style_dimensions.width,
      height: style_dimensions.height
    };
  }

  if (!image.src) {
    return {image: image, reason: 'sourceless'};
  }

  let source_url;
  try {
    source_url = new URL(image.src);
  } catch (error) {
    return {image: image, reason: 'badsource'};
  }

  let url_dimensions = find_url_dimensions(source_url);
  if (url_dimensions) {
    return {
      image: image,
      reason: 'url-sniff',
      width: url_dimensions.width,
      height: url_dimensions.height
    };
  }

  let fetched_image;
  try {
    fetched_image =
        await fetch_image_element(source_url, timeout, is_allowed_request);
  } catch (error) {
    if (is_ephemeral_fetch_error(error)) {
      return {image: image, reason: 'fetch-error'};
    }

    throw error;
  }

  return {
    image: image,
    reason: 'fetch',
    width: fetched_image.width,
    height: fetched_image.height
  };
}

// Try and find image dimensions from the characters of a url
function find_url_dimensions(source_url) {
  if (source_url.protocol === 'data:') {
    return;
  }

  const ext = url_utils.get_extension(source_url);
  if (!ext) {
    return;
  }

  const supported_extensions = ['jpg', 'gif', 'svg', 'jpg', 'bmp', 'png'];
  if (!supported_extensions.includes(ext)) {
    return;
  }

  // TODO: this code has a ton of nested blocks and is too difficult to read
  // and modify. Rewrite. Also, it is ok to set height even if width not set,
  // so the height stuff does not need to happen only in the width block.

  const named_attr_pairs =
      [{width: 'w', height: 'h'}, {width: 'width', height: 'height'}];

  // Infer from url parameters
  const params = source_url.searchParams;
  for (const pair of named_attr_pairs) {
    const width_string = params.get(pair.width);
    if (width_string) {
      const width_int = parseInt(width_string, 10);
      if (!isNaN(width_int)) {
        const height_string = params.get(pair.height);
        if (height_string) {
          const height_int = parseInt(height_string, 10);
          if (!isNaN(height_int)) {
            const dimensions = {};
            dimensions.width = width_int;
            dimensions.height = height_int;
            return dimensions;
          }
        }
      }
    }
  }
}

// Attempt to find the dimensions from the element's attributes
function find_style_dimensions(element) {
  const dimensions = {width: 0, height: 0};

  // TODO: this needs to correctly handle other image size formats, like width
  // as a percentage and such
  // Units are implicitly ignored in parseInt, this naively assumes pixel width
  // in all cases but that could be incorrect
  // TODO: look into using CSSOM

  if (element.hasAttribute('style') && element.style) {
    const width = parseInt(element.style.width, 10);
    if (!isNaN(width)) {
      dimensions.width = width;
    }

    const height = parseInt(element.style.height, 10);
    if (!isNaN(height)) {
      dimensions.height = height;
    }
  }

  return dimensions;
}

// TODO: avoid sending cookies, probably need to use fetch api and give up on
// using the simple element.src trick, it looks like HTMLImageElement does not
// allow me to control the request parameters and does send cookies, but I need
// to review this more, I am still unsure.
// @param is_allowed_request {Function} optional, is given a request-like
// object, throws a policy error if the function returns false
async function fetch_image_element(url, timeout = 0, is_allowed_request) {
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
function is_ephemeral_fetch_error(error) {
  return error instanceof FetchError || error instanceof PolicyError ||
      error instanceof TimeoutError;
}

// This error indicates a fetch operation failed for some reason like network
// unavailable, url could not be reached, etc
class FetchError extends Error {
  constructor(message = 'Failed to fetch') {
    super(message);
  }
}

// This error indicates a resource cannot be fetched because something about the
// http request violates the app's policy
class PolicyError extends Error {
  constructor(message = 'Refused to fetch url due to policy') {
    super(message);
  }
}

// This error indicates a fetch operation took too long
class TimeoutError extends Error {
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
