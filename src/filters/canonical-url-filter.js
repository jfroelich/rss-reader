'use strict';

// import base/status.js
// import dom/srcset.js
// import http/url.js

const CANONICAL_URL_FILTER_MAP = {
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

function canonical_url_filter(doc, base_url) {
  console.assert(doc instanceof Document);
  console.assert(url_is_url_object(base_url));

  const src_selector = canonical_url_filter_create_selector();

  const src_elements = doc.querySelectorAll(src_selector);
  for(const src_element of src_elements) {
    canonical_url_filter_resolve_attribute(src_element, base_url);
  }

  if(doc.body) {
    const srcset_elements = doc.body.querySelectorAll(
      'img[srcset], source[srcset]');
    for(const srcset_element of srcset_elements) {
      canonical_url_filter_resolve_srcset(srcset_element,
        base_url);
    }
  }

  return STATUS_OK;
}

function canonical_url_filter_create_selector() {
  const tags = Object.keys(CANONICAL_URL_FILTER_MAP);
  const parts = [];
  for(const tag of tags) {
    parts.push(`${tag}[${CANONICAL_URL_FILTER_MAP[tag]}]`);
  }
  return parts.join(',');
}

function canonical_url_filter_resolve_attribute(element, base_url) {
  const attribute_name = CANONICAL_URL_FILTER_MAP[element.localName];
  if(!attribute_name) {
    return;
  }

  const original_url = element.getAttribute(attribute_name);
  if(!original_url) {
    return;
  }

  const resolved_url_object = url_resolve(original_url, base_url);
  if(!resolved_url_object) {
    return;
  }

  if(resolved_url_object.href.length !== original_url.length) {
    element.setAttribute(attribute_name, resolved_url_object.href);
  }
}

function canonical_url_filter_resolve_srcset(element, base_url) {
  const srcset_attr_value = element.getAttribute('srcset');
  const descriptors = srcset_parse_from_string(srcset_attr_value);

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
    if(new_value) {
      element.setAttribute('srcset', new_value);
    }
  }
}
