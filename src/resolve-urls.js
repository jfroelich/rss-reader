// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: resolve xlink type simple (on any attribute) in xml docs
// TODO: finish implementing resolve_serialize_srcset
// TODO: rather than do a separate check for srcset, it should somehow be
// in the main map. but then that means we can't use a map because we
// have dup keys. so maybe the map needs to instead contain arrays of
// attribute names (similarly, support longdesc in iframe)
// TODO: look into whether srcset can be anywhere or just in img/source els
// TODO: maybe do not remove base, maybe that is not this functions role, but
// some other more general responsibility of calling context. After all, if
// all urls are absolute then leaving in base has no effect. it is only the
// caller in poll.js that is concerned about prepping
// the document for render and caring about removing base elements

// Resolves all urls in a document, such as element attribute values
// TODO: use a clearer name
function resolve_urls(document, baseURL) {
  resolve_remove_base_elements(document);
  resolve_modify_attributes(document, baseURL);
}

// Remove base. base is blacklisted in sanitize-document.js but the integrity
// of this module if used independently requires this behavior.
function resolve_remove_base_elements(document) {
  const bases = document.querySelectorAll('base');
  const numBases = bases.length;
  for(let i = 0; i < numBases; i++) {
    bases[i].remove();
  }
}

const RESOLVE_URL_ATTRIBUTE_MAP = {
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

function resolve_generate_selector_part(key) {
  return key + '[' + RESOLVE_URL_ATTRIBUTE_MAP[key] +']';
}

const RESOLVE_SELECTOR = Object.keys(RESOLVE_URL_ATTRIBUTE_MAP).map(
  resolve_generate_selector_part).join(',');

// TODO: i want to modify this so that I do not also check for
// srcset, I would rather be iterating over all elements, or iterate over
// srcset elements separately.

function resolve_modify_attributes(document, baseURL) {
  // Note this is not restricted to elements in the body, because there
  // are resolvable elements in the head, and <html> itself has a
  // resolvable attribute.

  const elements = document.querySelectorAll(RESOLVE_SELECTOR);
  const numElements = elements.length;
  for(let i = 0, element, attribute, originalURL,
    resolvedURL; i < numElements; i++) {
    element = elements[i];
    attribute = RESOLVE_URL_ATTRIBUTE_MAP[element.localName];
    originalURL = element.getAttribute(attribute).trim();
    resolvedURL = resolve_url(baseURL, originalURL);

    if(resolvedURL !== originalURL) {
      element.setAttribute(attribute, resolvedURL);
    }

    // Resolve srcsets
    if((element.localName === 'img' || element.localName === 'source') &&
      element.hasAttribute('srcset')) {
      resolve_resolve_srcset(baseURL, element);
    }
  }
}

// TODO: maybe reverse argument order?
// TODO: i am not sure yet but I think the built in URL object added to
// javascript can now do this for me, maybe I don't need the URI lib!
function resolve_url(baseURL, url) {
  try {
    const uri = new URI(url);
    if(!uri.protocol()) {
      const resolved = uri.absoluteTo(baseURL).toString();
      return resolved;
    }
  } catch(exception) {
    console.debug('Exception resolving url "%s": %o', url, exception);
  }

  return url;
}

// Access an element's srcset attribute, parses it into an array of
// descriptors, resolves the url for each descriptor, and then composes the
// descriptors array back into a string and modifies the element
function resolve_resolve_srcset(baseURL, element) {
  const source = element.getAttribute('srcset');
  let descriptors = parseSrcset(source) || [];
  let numURLsChanged = 0;
  let resolvedDescriptors = descriptors.map(function transform(descriptor) {
    const resolvedURL = resolve_url(baseURL, descriptor.url);
    let newURL = descriptor.url;
    if(resolvedURL && resolvedURL !== descriptor.url) {
      newURL = resolvedURL;
      numURLsChanged++;
    }

    return {
      url: newURL, d: descriptor.d, w: descriptor.w, h: descriptor.h
    };
  });

  if(numURLsChanged === 0) {
    return;
  }

  const newSource = resolve_serialize_srcset(resolvedDescriptors);
  console.debug('Changing srcset %s to %s', source, newSource);
  element.setAttribute('srcset', newSource);
}

// Returns a string representing serialized descriptors, which is a suitable
// srcset attribute value for an element
// TODO: THIS IS INCOMPLETE, because I do not yet include the other dimensions
// back into the string, and I am getting image errors in the output
// TODO: support d,w,h
function resolve_serialize_srcset(descriptors) {
  const resolvedDescriptors = [];
  const numDescriptors = descriptors.length;

  // TODO: i am also seeing something like url 2x or 1.5x, what's x?i assume
  // it is something like zoom level (2x is 2 times size)

  for(let i = 0, descriptor, newString; i < numDescriptors; i++) {
    console.debug('Descriptor:', descriptor);

    descriptor = descriptors[i];
    newString = descriptor.url;

    if(descriptor.d) {
      // newString += ' ' + descriptor.d;
    }

    if(descriptor.w) {
      // newString += ' ' + descriptor.w + 'w';
    }

    if(descriptor.h) {
      // newString += ' ' + descriptor.h + 'h';
    }

    resolvedDescriptors.push(newString);
  }

  // There must be a comma after the space, otherwise a comma can be
  // misinterpreted as part of the url (I guess?). I witnessed image fetch
  // errors where it looked like this was the case.
  return resolvedDescriptors.join(', ');
}
