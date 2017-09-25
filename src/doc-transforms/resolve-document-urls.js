(function(exports) {
'use strict';

// Looks for urls in the document and ensures they are absolute. Updates the
// attribute values by replacing any relative urls with absolute urls.
// Does not currently handle background props in inline css
function resolve_document_urls(doc, base_url) {
  if(Object.prototype.toString.call(base_url) !== '[object URL]')
    throw new TypeError('base_url is not of type URL');

  const element_attr_map = {
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

  const base_elements = doc.querySelectorAll('base');
  for(const base_element of base_elements)
    base_element.remove();

  const src_selector = create_src_selector(element_attr_map);
  const src_elements = doc.querySelectorAll(src_selector);
  for(const src_element of src_elements)
    resolve_mapped_attr(src_element, element_attr_map, base_url);

  const srcset_elements = doc.querySelectorAll('img[srcset], source[srcset]');
  for(const srcset_element of srcset_elements)
    resolve_srcset_attr(srcset_element, base_url);
}

function create_src_selector(element_attr_map) {
  const tag_names = Object.keys(element_attr_map);
  const parts = [];
  for(const tag_name of tag_names)
    parts.push(`${tag_name}[${element_attr_map[tag_name]}]`);
  return parts.join(',');
}

function resolve_mapped_attr(element, element_attr_map, base_url) {
  const attr_name = element_attr_map[element.localName];
  if(!attr_name)
    return;

  const url_string = element.getAttribute(attr_name);
  if(!url_string)
    return;

  const resolved_url_object = resolve_url(url_string, base_url);
  if(!resolved_url_object)
    return;

  const resolved_url_string = resolved_url_object.href;
  if(resolved_url_string.length !== url_string.length)
    element.setAttribute(attr_name, resolved_url_string);
}

function resolve_srcset_attr(element, base_url) {
  // The element has the attribute, but the attribute may not have a value.
  // parseSrcset requires a value or it may throw. While I catch exceptions
  // later I'd rather avoid exceptions where feasible
  const srcset_attr_value = element.getAttribute('srcset');
  if(!srcset_attr_value)
    return;

  let descriptors;
  try {
    descriptors = parseSrcset(srcset_attr_value);
  } catch(error) {
    return;
  }

  // extra precaution due to 3rd party
  if(!descriptors || !descriptors.length)
    return;

  // Resolve the urls of each descriptor. Set dirtied to true if at least
  // one url was resolved.
  let dirtied = false;
  for(const descriptor of descriptors) {
    const descriptor_url_string = descriptor.url;
    const resolved_url_object = resolve_url(descriptor_url_string, base_url);
    if(!resolved_url_object)
      continue;
    if(resolved_url_object.href !== descriptor_url_string) {
      dirtied = true;
      descriptor.url = resolved_url_object.href;
    }
  }

  if(!dirtied)
    return;

  const new_srcset_attr_value = serialize_srcset(descriptors);
  if(new_srcset_attr_value)
    element.setAttribute('srcset', new_srcset_attr_value);
}

// @param descriptors {Array} an array of descriptor objects
function serialize_srcset(descriptors) {
  const descriptor_strings = [];
  for(let descriptor of descriptors) {
    const strings = [descriptor.url];
    if(descriptor.d) {
      strings.push(' ');
      strings.push(descriptor.d);
      strings.push('x');
    } else if(descriptor.w) {
      strings.push(' ');
      strings.push(descriptor.w);
      strings.push('w');
    } else if(descriptor.h) {
      strings.push(' ');
      strings.push(descriptor.h);
      strings.push('h');
    }

    const descriptor_string = strings.join('');
    descriptor_strings.push(descriptor_string);
  }

  return descriptor_strings.join(', ');
}

// Returns the absolute form the input url
function resolve_url(url_string, base_url) {
  if(Object.prototype.toString.call(base_url) !== '[object URL]')
    throw new TypeError('base_url is not of type URL');

  // TODO: use a single regex for speed? Or maybe get the protocol,
  // normalize it, and check against a list of bad protocols?
  // TODO: or if it has any protocol, then just return the url as is?
  // - but that would still require a call to new URL
  // Or can we just check for the presence of any colon?
  if(/^\s*javascript:/i.test(url_string) ||
    /^\s*data:/i.test(url_string) ||
    /^\s*mailto:/i.test(url_string)) {
    return;
  }

  let absolute_url_object;
  try {
    absolute_url_object = new URL(url_string, base_url);
  } catch(error) {
  }
  return absolute_url_object;
}

exports.resolve_document_urls = resolve_document_urls;

}(this));
