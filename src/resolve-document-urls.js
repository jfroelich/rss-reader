// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const urlAttrMap = {
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

function buildSelectorPart(key) {
  return key + '[' + urlAttrMap[key] +']';
}

const selector = Object.keys(urlAttrMap).map(
  buildSelectorPart).join(',');

function resolveDocumentURLs(document, baseURL) {
  console.assert(document);
  console.assert(baseURL);

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
  const elements = document.querySelectorAll(selector);
  for(let element of elements) {
    resolveMappedAttr(element, baseURL);
  }

  const srcsetSelector = 'img[srcset], source[srcset]';
  const srcsetElements = document.querySelectorAll(srcsetSelector);
  for(let element of srcsetElements) {
    resolveSrcsetAttr(element, baseURL);
  }
}

function resolveMappedAttr(element, baseURL) {
  // Unfortunately we do not know which attribute to use, so look it up again
  const elementName = element.localName;
  const attrName = urlAttrMap[elementName];
  if(!attrName) {
    return;
  }

  const attrURL = element.getAttribute(attrName);
  if(!attrURL) {
    return;
  }

  const resolvedURL = resolveURL(attrURL, baseURL);
  // TODO: inequality test is weak because it does not ignore spaces and
  // is case sensitive and also does not consider normalization changes, maybe
  // make it weaker? Maybe it isn't too important to avoid a call to
  // setAttribute
  if(resolvedURL && resolvedURL.href !== attrURL) {
    element.setAttribute(attrName, resolvedURL.href);
  }
}

function resolveSrcsetAttr(element, baseURL) {
  console.assert(element);
  console.assert(baseURL);

  const attrURL = element.getAttribute('srcset');

  // The element has the attribute, but it may not have a value. parseSrcset
  // requires a value or it throws (??). Because parseSrcset is a 3rd party
  // API the check has merit.
  if(!attrURL) {
    return;
  }

  console.assert(parseSrcset);
  const srcset = parseSrcset(attrURL);

  // The parseSrcset function may fail to parse (??)
  // TODO: maybe I should be asserting definedness of srcset
  if(!srcset || !srcset.length) {
    return;
  }

  // Iterate over the descriptors and resolve each descriptor's url.
  let dirtied = false;
  for(let descriptor of srcset) {
    const resolvedURL = resolveURL(descriptor.url, baseURL);
    if(resolvedURL && resolvedURL.href !== descriptor.url) {
      dirtied = true;
      descriptor.url = resolvedURL.href;
    }
  }

  // If at least one descriptor was modified, then reserialize and overwrite
  // the attribute value. It is possible that all of the descriptors were
  // already absolute, so using the dirtied check saves on the call to
  // rdr.serializeSrcset and setAttribute
  if(dirtied) {
    const newSrcsetValue = rdr.serializeSrcset(srcset);
    if(newSrcsetValue) {
      element.setAttribute('srcset', newSrcsetValue);
    }
  }
}

// Returns a resolved URL object
function resolveURL(urlString, baseURLObject) {
  console.assert(urlString);
  console.assert(baseURLObject);

  if(isJavascriptURL(urlString)) {
    return;
  }

  if(isObjectURL(urlString)) {
    return;
  }

  // Do not throw. Just catch the exception and suppress it.
  // If an exception occurs this falls through to the implict return, which
  // means the function will return undefined.
  // Also, by minimizing the scope of the try/catch this avoids spreading the
  // deopt it causes to the caller fns
  try {
    return new URL(urlString, baseURLObject);
  } catch(error) {
    console.warn(urlString, baseURLObject.href, error);
  }
}

// Even though the regexs are defined within the functions here, I believe
// V8 and the like are smart enough to precompile once.

// Not to be confused with distinguishing between url strings and url objects,
// this checks if the string looks like an object url
// The test function tolerates nulls, so no asserts.
function isObjectURL(urlString) {
  return /^\s*data:/i.test(urlString);
}

// Returns true if the url looks like inline javascript
// The test function tolerates nulls, so no asserts.
function isJavascriptURL(urlString) {
  return /^\s*javascript:/i.test(urlString);
}

var rdr = rdr || {};
rdr.resolveDocumentURLs = resolveDocumentURLs;

} // End file block scope
