import '/third-party/parse-srcset.js';
import {url_is_allowed} from '/src/fetch-utils.js';

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

// @param descriptors {Array} an array of descriptors such as those produced
// by parseSrcset
// @returns {String} a string suitable for storing as srcset attribute value
export function srcset_serialize(descriptors) {
  assert(Array.isArray(descriptors));

  const descriptor_strings = [];
  for (const descriptor of descriptors) {
    const strings = [descriptor.url];
    if (descriptor.d) {
      strings.push(' ');
      strings.push(descriptor.d);
      strings.push('x');
    } else if (descriptor.w) {
      strings.push(' ');
      strings.push(descriptor.w);
      strings.push('w');
    } else if (descriptor.h) {
      strings.push(' ');
      strings.push(descriptor.h);
      strings.push('h');
    }

    const descriptor_string = strings.join('');
    descriptor_strings.push(descriptor_string);
  }

  return descriptor_strings.join(', ');
}

// Throws a basic error when the value is falsy with the optional message
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

// Parses a srcset value into an array of descriptors. If the input is bad, or
// an error occurs, or no descriptors found, returns an empty array. This
// function makes use of third-party code.
// @param srcset {Any} preferably a string, the value of a srcset attribute of
// an element
export function parse_srcset_wrapper(srcset) {
  const fallback_output = [];

  // Tolerate bad input for convenience
  if (typeof srcset !== 'string') {
    return fallback_output;
  }

  // Avoid parsing empty string
  if (!srcset) {
    return fallback_output;
  }

  // parseSrcset doesn't throw in the ordinary case, but avoid surprises
  let descriptors;
  try {
    descriptors = parseSrcset(srcset);
  } catch (error) {
    console.warn(error);
    return fallback_output;
  }

  if (!Array.isArray(descriptors)) {
    return fallback_output;
  }

  return descriptors;
}

// Replace an element with its child nodes. Special care is taken to add
// whitespace if the operation would result in adjacent text nodes. The element
// should be attached (it should be a node, or a descendant of a node, that is
// in the document).
export function element_unwrap(element) {
  assert(element instanceof Element);

  // An orphaned node is any parentless node. An orphaned node is obviously
  // detached from the document, as all attached nodes have a parent. There is
  // generally no benefit to unwrapping orphans.
  //
  // Although attempting to unwrap an orphaned node should probably represent a
  // programming error, and so in some sense this case should never be true,
  // just exit early. Encourage the caller to change their behavior.
  if (!element.parentNode) {
    console.warn('Tried to unwrap orphaned element', element.outerHTML);
    return;
  }

  // Cache stuff prior to removal
  const parent_element = element.parentNode;
  const psib = element.previousSibling;
  const nsib = element.nextSibling;
  const fchild = element.firstChild;
  const lchild = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();

  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();

  // Add leading padding
  if (psib && psib.nodeType === TEXT && fchild && fchild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // Move children to fragment, maintaining order
  for (let node = fchild; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  // Add trailing padding
  if (lchild && fchild !== lchild && nsib && nsib.nodeType === TEXT &&
      lchild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // If nsib is undefined then insertBefore appends
  parent_element.insertBefore(frag, nsib);
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

// TODO: in hindsight this function is overly simplistic, just inline it
// (probably need to export element_coerce in its place)
export function element_coerce_all(
    ancestor_element, old_name, new_name, copy_attributes_flag) {
  assert(ancestor_element instanceof Element);
  assert(typeof old_name === 'string');
  assert(typeof new_name === 'string');

  const elements = ancestor_element.querySelectorAll(old_name);
  for (const element of elements) {
    element_coerce(element, new_name, copy_attributes_flag);
  }
}

// element_coerce essentially a renames an element. An element's name indicates
// the element's type. Hence the name of this function, because this effectively
// changes the html type of the element. The element's child nodes are retained,
// generally without regard to whether the new parent-child relations are
// sensible. However, if the new name is the name of one of HTML's void
// elements, then the child nodes of the element are effectively removed (all
// children are removed during the call, but children of void elements are not
// re-added).
//
// Event listeners are lost on rename. See
// https://stackoverflow.com/questions/15408394. This generally is not a concern
// in the case of content filtering because attributes that would cause binding
// are filtered prior to binding.
//
// element_coerce does not validate whether the result is correct, except in the
// case of renaming an element to a known void element. It is the caller's
// responsibility to ensure that the coercion makes sense and that the resulting
// document is still 'well-formed', supposing that well-formedness is a
// requirement. Don't forget, the new element may not belong under its parent,
// or its children may not belong under it either. There is the possiblity of a
// hierarchy error being thrown by the DOM in the final insertBefore call but so
// far I have not encountered it.
//
// @param element {Element} the element to change
// @param new_name {String} the name of the element's new type
// @param copy_attributes_flag {Boolean} optional, if true then attributes are
// maintained, defaults to true.
// @throws {Error} if the input element is not a type of Element, such as when
// it is undefined, or if the new name is not valid. Note that the name validity
// check is very minimal and not spec compliant.
// @return {Element} the new element that replaced the old one
function element_coerce(element, new_name, copy_attributes_flag = true) {
  assert(element instanceof Element);

  // Document.prototype.createElement is very forgiving regarding a new
  // element's name. For example, if you pass a null value, it will create an
  // element named "null". I find this behavior very confusing and misleading.
  // To avoid this, treat any attempt to use an invalid name as a programming
  // error. Specifically disallow createElement(null) working like
  // createElement("null")
  assert(element_name_is_valid(new_name));

  // Treat attempting to rename an element to the same name as a noop. I've
  // decided to allow this for caller convenience as opposed to throwing an
  // error. Assume the document is html-flagged
  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  // TODO: rename var
  // Prior to detachment, cache the reference to the parent
  const parent_element = element.parentNode;

  // Treat attempting to rename an orphaned element as a noop. Caller not
  // required to guarantee parent for reasons of convenience.
  if (!parent_element) {
    return element;
  }

  // TODO: rename var
  // Use next sibling to record position prior to detach. May be undefined.
  const nsib = element.nextSibling;

  // Detach the existing node prior to performing other dom operations so that
  // later operations take place on a detached node, so that the least amount
  // of live dom operations are made. Implicitly this sets element.parentNode
  // and element.nextSibling to undefined.
  element.remove();

  // NOTE: a detached element is still 'owned' by a document
  // NOTE: we are using the document in which the element resides, not the
  // document executing this function. This would otherwise be a serious XSS
  // vulnerability, and also possibly trigger document adoption (which is slow).

  const new_element = element.ownerDocument.createElement(new_name);

  if (copy_attributes_flag) {
    element_copy_attributes(element, new_element);
  }

  element_move_child_nodes(element, new_element);

  // Attach the new element in place of the old element. If nextSibling is
  // undefined then insertBefore simply appends. Return the new element.
  return parent_element.insertBefore(new_element, nsib);
}

// Move all child nodes of from_element to to_element, maintaining order. If
// to_element has existing children, the new elements are appended at the end.
// NOTE: I've looked for ways of doing this faster, but nothing seems to work.
// There is no batch move operation in native dom.
// TODO: one possible speedup might be using a document fragment? See what I
// did for unwrap
// TODO: might not need to export
export function element_move_child_nodes(from_element, to_element) {
  // If the target is a void element then this is a no-op. This assumes the
  // source element is detached. The result in this case is the child nodes
  // are effectively deleted.
  if (element_is_void(to_element)) {
    return;
  }

  // Each call to appendChild does the move. As such, in each iteration, the
  // next accessing of old parent's firstChild points to the old parent's new
  // first child, if any children are left.
  let node = from_element.firstChild;
  while (node) {
    to_element.appendChild(node);
    node = from_element.firstChild;
  }
}

// See https://html.spec.whatwg.org/multipage/syntax.html#void-elements
// This is a set, but given the small size, it is better to use a simple array.
const void_elements = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];

// Returns whether an element is a void element. This assumes
// element.ownerDocument is implicitly flagged as html so that localName yields
// the normalized name which is in lowercase. For now I'd rather make the
// assumption and let errors happen than incur the cost of calling toLowerCase
export function element_is_void(element) {
  return void_elements.includes(element.localName);
}

// Returns true if the given name is a valid name for an element. This only
// does minimal validation and may yield false positives. This function is
// defensive so it can easily be asserted against.
// TODO: research what characters are allowed in an element's name
function element_name_is_valid(value) {
  return typeof value === 'string' && value.length && !value.includes(' ');
}

// Copies the attributes of an element to another element. Overwrites any
// existing attributes in the other element.
// @param from_element {Element}
// @param to_element {Element}
// @throws {Error} if either element is not an Element
// @returns void
export function element_copy_attributes(from_element, to_element) {
  // Use getAttributeNames in preference to element.attributes due to
  // performance issues with element.attributes, and to allow unencumbered use
  // of the for..of syntax (I had issues with NamedNodeMap and for..of).
  const names = from_element.getAttributeNames();
  for (const name of names) {
    const value = from_element.getAttribute(name);
    to_element.setAttribute(name, value);
  }
}

// Adapted from https://github.com/kangax/html-minifier/issues/63
const boolean_attribute_names = [
  'allowfullscreen', 'async',          'autofocus',     'autoplay',
  'checked',         'compact',        'controls',      'declare',
  'default',         'defaultchecked', 'defaultmuted',  'defaultselected',
  'defer',           'disabled',       'draggable',     'enabled',
  'formnovalidate',  'hidden',         'indeterminate', 'inert',
  'ismap',           'itemscope',      'loop',          'multiple',
  'muted',           'nohref',         'noresize',      'noshade',
  'novalidate',      'nowrap',         'open',          'pauseonexit',
  'readonly',        'required',       'reversed',      'scoped',
  'seamless',        'selected',       'sortable',      'spellcheck',
  'translate',       'truespeed',      'typemustmatch', 'visible'
];

// Returns whether the attribute name is boolean. The element parameter is
// present due to legacy code, and currently unused, but I decided to leave it
// in, in the case that in the future I decide to vary the outcome of the
// boolean determination based on the type of element in addition to attribute
// name.
export function attribute_is_boolean(element, attribute_name) {
  return boolean_attribute_names.includes(attribute_name);
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
      // TODO: examine if there is a discernible error message to use rather
      // than creating a custom one
      console.dir(event);
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

// Returns true if other_url is 'external' to the document_url. Inaccurate and
// insecure.
export function url_is_external(document_url, other_url) {
  // Certain protocols are never external in the sense that a network request
  // is not performed
  const local_protocols = ['data:', 'mailto:', 'tel:', 'javascript:'];
  if (local_protocols.includes(other_url.protocol)) {
    return false;
  }

  const doc_domain = url_get_upper_domain(document_url);
  const other_domain = url_get_upper_domain(other_url);
  return doc_domain !== other_domain;
}

// Returns the 1st and 2nd level domains as a string. Basically hostname
// without subdomains. This only does minimal symbolic validation of values,
// and is also inaccurate and insecure.
function url_get_upper_domain(url) {
  assert(url instanceof URL);

  // Treat IP as whole
  if (hostname_is_ipv4(url.hostname) || hostname_is_ipv6(url.hostname)) {
    return url.hostname;
  }

  const levels = url.hostname.split('.');

  // Handle the simple case of 'localhost'
  if (levels.length === 1) {
    return url.hostname;
  }

  // Handle the simple case of 'example.com'
  if (levels.length === 2) {
    return url.hostname;
  }

  // This isn't meant to be super accurate or professional. Using the full list
  // from https://publicsuffix.org/list/public_suffix_list.dat is overkill. As
  // a compromise, just look at character count of top level domain. If
  // character count is 2, assume it is a geotld, and return 3 levels. Otherwise
  // return 2.
  const top_level = levels[levels.length - 1];
  if (top_level.length === 2) {
    // Infer it is ccTLD, return levels 3 + 2 + 1
    const used_levels = levels.slice(-3);
    return used_levels.join('.');
  } else {
    // Infer it is gTLD, returns levels 2 + 1
    const used_levels = levels.slice(-2);
    return used_levels.join('.');
  }
}

function hostname_is_ipv4(string) {
  if (typeof string !== 'string') {
    return false;
  }

  const parts = string.split('.');
  if (parts.length !== 4) {
    return false;
  }

  for (const part of parts) {
    const digit = parseInt(part, 10);
    if (isNaN(digit) || digit < 0 || digit > 255) {
      return false;
    }
  }

  return true;
}

// Expects a hostname string property value from a URL object.
function hostname_is_ipv6(value) {
  return typeof value === 'string' && value.includes(':');
}
