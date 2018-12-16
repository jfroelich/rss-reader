import assert from '/src/assert.js';
import * as srcset from '/src/base/srcset.js';

const element_url_attribute_map = {
  a: 'href',
  applet: 'codebase',
  area: 'href',
  audio: 'src',
  base: 'href',
  blockquote: 'cite',
  body: 'background',
  button: 'formaction',
  del: 'cite',
  embed: 'src',
  frame: 'src',
  head: 'profile',
  html: 'manifest',
  iframe: 'src',
  form: 'action',
  img: 'src',
  input: 'src',
  ins: 'cite',
  link: 'href',
  object: 'data',
  q: 'cite',
  script: 'src',
  source: 'src',
  track: 'src',
  video: 'src'
};

// Initialize the selector once on module load
const element_url_attr_selector = build_resolver_selector();

function build_resolver_selector() {
  const keys = Object.keys(element_url_attribute_map);
  const parts = [];
  for (const key of keys) {
    parts.push(`${key}[${element_url_attribute_map[key]}]`);
  }
  return parts.join(',');
}

// Resolves all attribute values that contain urls
//
// @param document {Document} the document to mutate
// @error {Error} if document is not a Document
// @throws {Error} if document.baseURI is undefined or an invalid url
export function url_resolve_filter(document) {
  // Although this would be caught later, I prefer an explicit sanity check
  assert(typeof document.baseURI === 'string');

  // If the baseURI is set but not a well-formed canonical url, this still
  // throws. Otherwise, this does the deserialization once up front for later
  // use in all transformations
  const base_url = new URL(document.baseURI);

  const src_elements = document.querySelectorAll(element_url_attr_selector);

  for (const src_element of src_elements) {
    resolve_attr(src_element, base_url);
  }

  if (document.body) {
    const srcset_sel = 'img[srcset], source[srcset]';
    const srcset_els = document.body.querySelectorAll(srcset_sel);
    for (const element of srcset_els) {
      resolve_srcset(element, base_url);
    }
  }
}

function resolve_attr(element, base_url) {
  const attribute_name = element_url_attribute_map[element.localName];
  if (!attribute_name) {
    return;
  }

  const original_url_string = element.getAttribute(attribute_name);
  if (!original_url_string) {
    return;
  }

  const resolved_url = resolve_url_string(original_url_string, base_url);
  if (!resolved_url) {
    return;
  }

  if (resolved_url.href !== original_url_string) {
    element.setAttribute(attribute_name, resolved_url.href);
  }
}

function resolve_srcset(element, base_url) {
  const descriptors = srcset.parse(element.getAttribute('srcset'));

  let change_count = 0;
  for (const descriptor of descriptors) {
    const resolved_url = resolve_url_string(descriptor.url, base_url);
    if (resolved_url && resolved_url.href.length !== descriptor.url.length) {
      descriptor.url = resolved_url.href;
      change_count++;
    }
  }

  if (change_count) {
    const new_value = srcset.serialize(descriptors);
    if (new_value) {
      element.setAttribute('srcset', new_value);
    }
  }
}

// Resolve a url
// @param url_string {String} a relative or absolute url string
// @param base_url {URL} a base url to use for resolution
// @returns {URL} the resolved url or undefined on error
function resolve_url_string(url_string, base_url) {
  // Guard against passing empty string to URL constructor as that simply
  // clones the base url
  if (url_string && typeof url_string === 'string' && url_string.trim()) {
    try {
      return new URL(url_string, base_url);
    } catch (error) {
    }
  }
}
