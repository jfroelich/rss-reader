import {element_unwrap} from '/src/dom/element-unwrap.js';
import {url_is_allowed} from '/src/fetch/fetch.js';

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

// Resolve a url
// @param url_string {String} a relative or absolute url string
// @param base_url {URL} a base url to use for resolution
// @returns {URL} the resolved url or undefined
export function url_string_resolve(url_string, base_url) {
  // Guard against passing empty string to URL constructor as that simply
  // clones the base url
  if (typeof url_string === 'string' && url_string && url_string.trim()) {
    try {
      return new URL(url_string, base_url);
    } catch (error) {
    }
  }
}

export function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

export function string_condense_whitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

// Returns true if the image element has at least one source, which could be a
// src attribute, a srcset attribute, or an associate picture element with one
// or more source elements that has a src or srcset attribute. This does not
// check whether the urls are syntactically correct, but this does check that an
// attribue value is not empty after trimming.
export function image_has_source(image) {
  assert(image instanceof Element);

  const has = element_attribute_not_empty_after_trim;  // local alias

  // Check if the image element itself has a source
  if (has(image, 'src') || has(image, 'srcset')) {
    return true;
  }

  // Check if the image element is part of a picture that has a descendant
  // source with a source attribute value
  const picture = image.closest('picture');
  if (picture) {
    const sources = picture.getElementsByTagName('source');
    for (const source of sources) {
      if (has(source, 'src') || has(source, 'srcset')) {
        return true;
      }
    }
  }

  return false;
}

// Removes an image element from its containing document along with some baggage
export function image_remove(image) {
  // This check is implicit in later checks. However, performing it redundantly
  // upfront here can avoid a substantial amount of processing. There is no
  // apparent value in removing an orphaned image, so silently cancel.
  if (!image.parentNode) {
    return;
  }

  const figure = image.closest('figure');
  if (figure) {
    // While it is tempting to simply remove the figure element itself and
    // thereby indirectly remove the image, this would risk data loss. The
    // figure may be used as a general container and contain content not related
    // to the image. The only content we know for certain that is related to
    // to the image in this case is the caption. There should only be one,
    // but this cannot assume well-formedness, so remove any captions.
    const captions = figure.querySelectorAll('figcaption');
    for (const caption of captions) {
      caption.remove();
    }

    element_unwrap(figure);
  }

  const picture = image.closest('picture');
  if (picture) {
    // Similar to figure, picture may be used as general container, so unwrap
    // rather than remove. The only thing we know that can be removed are the
    // source elements.
    const sources = picture.querySelectorAll('source');
    for (const source of sources) {
      source.remove();
    }

    element_unwrap(picture);
  }

  image.remove();
}

function element_attribute_not_empty_after_trim(element, attributeName) {
  const value = element.getAttribute(attributeName);
  return (value && value.trim()) ? true : false;
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
    assert(url_is_allowed(url));

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
