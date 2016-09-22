// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.poll = rdr.poll || {};
rdr.poll.resolve = {};

rdr.poll.resolve.urlAttrMap = {
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

rdr.poll.resolve.buildSelectorPart = function(key) {
  return key + '[' + rdr.poll.resolve.urlAttrMap[key] +']';
};

rdr.poll.resolve.selector = Object.keys(
  rdr.poll.resolve.urlAttrMap).map(
    rdr.poll.resolve.buildSelectorPart).join(',');

rdr.poll.resolve.start = function(document, baseURL) {
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

  const elements = document.querySelectorAll(rdr.poll.resolve.selector);
  for(let element of elements) {
    rdr.poll.resolve.resolveMappedAttr(element, baseURL);
  }

  const srcsets = document.querySelectorAll('img[srcset], source[srcset]');
  for(let element of srcsets) {
    rdr.poll.resolve.resolveSrcsetAttr(element, baseURL);
  }
};

rdr.poll.resolve.resolveMappedAttr = function(element, baseURL) {
  const elementName = element.localName;
  const attrName = rdr.poll.resolve.urlAttrMap[elementName];
  if(!attrName) {
    return;
  }

  const attrURL = element.getAttribute(attrName);
  if(!attrURL) {
    return;
  }

  const resolvedURL = rdr.poll.resolve.resolveURL(attrURL, baseURL);
  // TODO: inequality test is weak because it does not ignore spaces and
  // is case sensitive and also does not consider normalization changes, maybe
  // make it weaker? Maybe it isn't too important to avoid a call to
  // setAttribute
  if(resolvedURL && resolvedURL.href !== attrURL) {
    element.setAttribute(attrName, resolvedURL.href);
  }
};

rdr.poll.resolve.resolveSrcsetAttr = function(element, baseURL) {
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

  let dirtied = false;
  for(let descriptor of srcset) {
    const resolvedURL = rdr.poll.resolve.resolveURL(descriptor.url,
      baseURL);
    if(resolvedURL && resolvedURL.href !== descriptor.url) {
      dirtied = true;
      descriptor.url = resolvedURL.href;
    }
  }

  if(dirtied) {
    const newSrcsetValue = rdr.utils.serializeSrcset(srcset);
    if(newSrcsetValue) {
      element.setAttribute('srcset', newSrcsetValue);
    }
  }
};

// Returns a resolved URL object
rdr.poll.resolve.resolveURL = function(urlString, baseURLObject) {
  console.assert(urlString);
  console.assert(baseURLObject);

  if(rdr.poll.resolve.isJavascriptURL(urlString)) {
    return;
  }

  if(rdr.poll.resolve.isObjectURL(urlString)) {
    return;
  }

  try {
    return new URL(urlString, baseURLObject);
  } catch(error) {
    console.warn(urlString, baseURLObject.href, error);
  }
};

rdr.poll.resolve.isObjectURL = function(urlString) {
  return /^\s*data:/i.test(urlString);
};

rdr.poll.resolve.isJavascriptURL = function(urlString) {
  return /^\s*javascript:/i.test(urlString);
};
