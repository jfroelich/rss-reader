'use strict';

// Dependencies
// assert.js
// srcset.js
// url.js

// TODO: there are no other url filters, maybe simplify to just name
// url filter?

const CANONICAL_URL_FILTER_ELEMENT_ATTRIBUTE_MAP = {
  'a': 'href',
  'applet': 'codebase',
  'area': 'href',
  'audio': 'src',
  'base': 'href',
  'blockquote': 'cite',
  'body': 'background',
  'button': 'formaction',
  'del': 'cite',
  'embed': 'src',
  'frame': 'src',
  'head': 'profile',
  'html': 'manifest',
  'iframe': 'src',
  'form': 'action',
  'img': 'src',
  'input': 'src',
  'ins': 'cite',
  'link': 'href',
  'object': 'data',
  'q': 'cite',
  'script': 'src',
  'source': 'src',
  'track': 'src',
  'video': 'src'
};

// Looks for urls in the document and ensures they are absolute. Updates the
// attribute values by replacing any relative urls with absolute urls.
// Does not currently handle background props in inline css
function canonical_url_filter(doc, base_url) {
  ASSERT(doc);
  ASSERT(url_is_url_object(base_url));

  const src_selector = canonical_url_filter_create_src_selector();

  const src_elements = doc.querySelectorAll(src_selector);
  for(const src_element of src_elements) {
    canonical_url_filter_resolve_mapped_attr(src_element, base_url);
  }

  if(doc.body) {
    const srcset_elements = doc.body.querySelectorAll(
      'img[srcset], source[srcset]');
    for(const srcset_element of srcset_elements) {
      canonical_url_filter_resolve_srcset_attr(srcset_element,
        base_url);
    }
  }
}

// TODO: init once
function canonical_url_filter_create_src_selector() {
  const map = CANONICAL_URL_FILTER_ELEMENT_ATTRIBUTE_MAP;
  const tag_names = Object.keys(map);
  const parts = [];

  for(const tag_name of tag_names) {
    parts.push(`${tag_name}[${map[tag_name]}]`);
  }

  return parts.join(',');
}

function canonical_url_filter_resolve_mapped_attr(element, base_url) {

  const attr_name = CANONICAL_URL_FILTER_ELEMENT_ATTRIBUTE_MAP[
    element.localName];
  if(!attr_name)
    return;

  const original_url = element.getAttribute(attr_name);
  if(!original_url)
    return;

  const resolved_url_object = url_resolve(original_url, base_url);
  if(!resolved_url_object)
    return;

  if(resolved_url_object.href.length !== original_url.length)
    element.setAttribute(attr_name, resolved_url_object.href);
}

function canonical_url_filter_resolve_srcset_attr(element, base_url) {
  const srcset_attr_value = element.getAttribute('srcset');
  const descriptors = srcset_parse_from_string(srcset_attr_value);

  // Resolve the urls of each descriptor.
  let change_count = 0;
  for(const descriptor of descriptors) {
    const resolved_url_object = url_resolve(descriptor.url, base_url);

    if(resolved_url_object &&
      resolved_url_object.href.length !== descriptor.url.length) {
      descriptor.url = resolved_url_object.href;
      change_count++;
    }
  }

  if(change_count) {
    const new_value = srcset_serialize(descriptors);
    if(new_value)
      element.setAttribute('srcset', new_value);
  }
}
