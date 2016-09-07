// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const URL_ATTRIBUTE_MAP = {
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

function build_selector_part(key) {
  return key + '[' + URL_ATTRIBUTE_MAP[key] +']';
}

const SELECTOR = Object.keys(URL_ATTRIBUTE_MAP).map(
  build_selector_part).join(',');

function resolve_document_urls(document, base_url) {
  console.assert(document);
  console.assert(base_url);

  // Remove base elements. There is actually no need to do this, because this
  // is done when sanitizing the document, and because all relative urls are
  // made absolute. However, I am doing this now for sanity reasons, and may
  // remove this behavior in the future. I am also not sure if this is the
  // responsibility of this function.
  // Also, there is a deeper issue of whether a page author is using base
  // intentionally. That could throw off this entire approach because it
  // conflicts with using a custom base url. This uses a custom base largely
  // so I can take advantage of using the redirect url from the page fetch,
  // so that I am not doing additional redirects per link click or 404s on
  // embedded images
  const bases = document.querySelectorAll('base');
  for(let base of bases) {
    base.remove();
  }

  // Resolve element attribute urls
  const elements = document.querySelectorAll(SELECTOR);
  for(let element of elements) {
    resolve_mapped_attr(element, base_url);
  }

  const srcset_selector = 'img[srcset], source[srcset]';
  const srcset_els = document.querySelectorAll(srcset_selector);
  for(let element of srcset_els) {
    resolve_srcset_attr(element, base_url);
  }
}

function resolve_mapped_attr(element, base_url) {
  // Unfortunately we do not know which attribute to use, so look it up again
  const element_name = element.localName;
  const attr_name = URL_ATTRIBUTE_MAP[element_name];
  if(!attr_name) {
    return;
  }

  const attr_url = element.getAttribute(attr_name);
  if(!attr_url) {
    return;
  }

  const resolved_url = resolve_url(attr_url, base_url);
  // TODO: inequality test is weak because it does not ignore spaces and
  // is case sensitive and also does not consider normalization changes, maybe
  // make it weaker? Maybe it isn't too important to avoid a call to
  // setAttribute
  if(resolved_url && resolved_url.href !== attr_url) {
    element.setAttribute(attr_name, resolved_url.href);
  }
}

function resolve_srcset_attr(element, base_url) {
  console.assert(element);
  console.assert(base_url);

  const attr_url = element.getAttribute('srcset');

  // The element has the attribute, but it may not have a value. parseSrcset
  // requires a value or it throws (??). Because parseSrcset is a 3rd party
  // API the check has merit.
  if(!attr_url) {
    return;
  }

  console.assert(parseSrcset);
  const srcset = parseSrcset(attr_url);

  // The parseSrcset function may fail to parse (??)
  // TODO: maybe I should be asserting definedness of srcset
  if(!srcset || !srcset.length) {
    return;
  }

  // Iterate over the descriptors and resolve each descriptor's url.
  let dirtied = false;
  for(let descriptor of srcset) {
    const resolved_url = resolve_url(descriptor.url, base_url);
    if(resolved_url && resolved_url.href !== descriptor.url) {
      dirtied = true;
      descriptor.url = resolved_url.href;
    }
  }

  // If at least one descriptor was modified, then reserialize and overwrite
  // the attribute value. It is possible that all of the descriptors were
  // already absolute, so using the dirtied check saves on the call to
  // serialize_srcset and setAttribute
  if(dirtied) {
    const new_srcset_value = serialize_srcset(srcset);
    if(new_srcset_value) {
      element.setAttribute('srcset', new_srcset_value);
    }
  }
}

// Returns a resolved URL object
function resolve_url(url_string, base_url_object) {
  console.assert(url_string);
  console.assert(base_url_object);

  if(is_javascript_url(url_string)) {
    return;
  }

  if(is_object_url(url_string)) {
    return;
  }

  // Do not throw. Just catch the exception and suppress it.
  // If an exception occurs this falls through to the implict return, which
  // means the function will return undefined.
  // Also, by minimizing the scope of the try/catch this avoids spreading the
  // deopt it causes to the caller fns
  try {
    return new URL(url_string, base_url_object);
  } catch(error) {
    console.warn(url_string, base_url_object.href, error);
  }
}

// Even though the regexs are defined within the functions here, I believe
// V8 and the like are smart enough to precompile once.

// Not to be confused with distinguishing between url strings and url objects,
// this checks if the string looks like an object url
// The test function tolerates nulls, so no asserts.
function is_object_url(url_string) {
  return /^\s*data:/i.test(url_string);
}

// Returns true if the url looks like inline javascript
// The test function tolerates nulls, so no asserts.
function is_javascript_url(url_string) {
  return /^\s*javascript:/i.test(url_string);
}

this.resolve_document_urls = resolve_document_urls;

} // End file block scope
