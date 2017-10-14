'use strict';

// Dependencies
// assert.js
// srcset.js
// url.js

// TODO:
// * remove IIAFE
// * rename to html-url-filter or something like this?

(function(exports) {


// Looks for urls in the document and ensures they are absolute. Updates the
// attribute values by replacing any relative urls with absolute urls.
// Does not currently handle background props in inline css
function canonicalize_document(doc, base_url) {
  ASSERT(url_is_url_object(base_url));

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

  const resolved_url_object = url_resolve(url_string, base_url);
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
    const resolved_url_object = url_resolve(descriptor_url_string, base_url);
    if(!resolved_url_object)
      continue;
    if(resolved_url_object.href !== descriptor_url_string) {
      dirtied = true;
      descriptor.url = resolved_url_object.href;
    }
  }

  if(!dirtied)
    return;

  const new_srcset_attr_value = srcset_serialize(descriptors);
  if(new_srcset_attr_value)
    element.setAttribute('srcset', new_srcset_attr_value);
}

exports.canonicalize_document = canonicalize_document;

}(this));

/*

* Should probably be rewritten to only inspect relevant attributes per
element type, instead of a general map?
* use a more qualified or clearer function name for resolveElement, this
resolves the value for a particular url-containing attribute of the element
* not entirely sure why i have this see also comment, i think it was help in
defining the attribute map

See also https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js

Regarding resolving doc urls


* think about what to do about the common '#' url. Usually these are just
links back to the top, or have an onclick handler. maybe these should be
treated specially by a separate transform.
* resolve xlink type simple (on any attribute) in xml docs

# TODO: Support css background-image/background urls
check if image has inline style, and if so, inspect the style property, and if
it has a background or background image property, and that property has a url,
then ensure the url is absolute.

what about the fact that style is removed from all attributes when scrubbing
 the dom. This makes this operation seem pointless.

I could revise the attribute filtering part to allow for style background image.
But then I need to think more about how that can affect a rendered article
*/
