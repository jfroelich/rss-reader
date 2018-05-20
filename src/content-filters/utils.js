// TODO: if I want to fully move content-filters to lib then this cannot depend
// on an app module
import {fetch_policy} from '/src/fetch-policy.js';
import {element_unwrap} from '/src/lib/element-unwrap.js';

// Returns a file name without its extension (and without the '.')
export function file_name_filter_extension(file_name) {
  assert(typeof file_name === 'string');
  const index = file_name.lastIndexOf('.');
  return index < 0 ? file_name : file_name.substring(0, index);
}

// Gets the file name part of a url, or undefined
export function url_get_filename(url) {
  assert(url instanceof URL);
  const index = url.pathname.lastIndexOf('/');
  if ((index > -1) && (index + 1 < url.pathname.length)) {
    return url.pathname.substring(index + 1);
  }
}

// Returns a promise that resolves to undefined after a given amount of time (in
// milliseconds). By racing this promise against another promise, this is useful
// for imposing a timeout on the other operation.
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

// Returns true if an element is hidden according to its inline style
export function element_is_hidden_inline(element) {
  // It is an error to call this on something other than an element
  assert(element instanceof Element);
  // offset width and height are unreliable in an inert document so this must
  // rely on style. style may be undefined for elements such as <math>, in which
  // case elements are presumed visible. style.length is 0 when no inline
  // properties set.
  const style = element.style;
  return style && style.length &&
      (style.display === 'none' || style.visibility === 'hidden' ||
       element_is_near_transparent(style) || element_is_offscreen(style));
}

// Returns true if the element's opacity is too close to 0
// Throws error is style is undefined
// TODO: support other formats of the opacity property more accurately
// TODO: how does negative opacity work, or other invalid opacities?
// TODO: https://stackoverflow.com/questions/1887104 specifically
// window.getComputedStyle(element, null).getPropertyValue('opacity');
// https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/getPropertyValue
// The CSSStyleDeclaration.getPropertyValue() method interface returns a
// DOMString containing the value of a specified CSS property.
function element_is_near_transparent(style) {
  if (style.opacity) {
    const visibility_threshold = 0.3;
    const opacity_f = parseFloat(style.opacity);
    return !isNaN(opacity_f) && opacity_f <= visibility_threshold;
  }
}

// Returns true if the element is positioned off screen. Heuristic guess.
// Probably several false negatives, and a few false positives. The cost of
// guessing wrong is not too high. This is inaccurate.
function element_is_offscreen(style) {
  if (style.position === 'absolute') {
    const left = parseInt(style.left, 10);
    if (!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}

// Fetches an image element. Returns a promise that resolves to a fetched image
// element. Data URIs are accepted.
// @param url {URL}
// @param timeout {Number}
// @returns {Promise}
export async function fetch_image_element(url, timeout) {
  assert(
      typeof timeout === 'undefined' || timeout === null ||
      (Number.isInteger(timeout) && timeout >= 0));
  const fetch_promise = fetch_image_element_promise(url);
  const contestants =
      timeout ? [fetch_promise, sleep(timeout)] : [fetch_promise];
  const image = await Promise.race(contestants);
  assert(image, 'Fetched timed out ' + url.href);
  return image;
}

function fetch_image_element_promise(url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const allowed_protocols = ['data:', 'http:', 'https:'];
    assert(allowed_protocols.includes(url.protocol));
    assert(fetch_policy.allows_url(url));

    // Create a proxy element within this script's document
    const proxy = new Image();
    // Set the proxy's source to trigger the fetch
    proxy.src = url.href;

    // If cached then resolve immediately
    if (proxy.complete) {
      return resolve(proxy);
    }

    proxy.onload = () => resolve(proxy);
    proxy.onerror = (event) => {
      // NOTE: the event does not contain a useful error object, or any error
      // information at all really, so create our own error
      reject(new Error('Unknown error fetching image ' + url.href));
    };
  });
}

// Only minor validation for speed. Tolerates bad input. This isn't intended to
// be the most accurate classification. Instead, it is intended to easily find
// bad urls and rule them out as invalid, even though some slip through, and not
// unintentionally rule out good urls.
// @param value {Any} should be a string but this tolerates bad input
// @returns {Boolean}
export function url_string_is_valid(value) {
  // The upper bound on len is an estimate, kind of a safeguard, hopefully never
  // causes a problem
  return typeof value === 'string' && value.length > 1 &&
      value.length <= 3000 && !value.trim().includes(' ');
}
