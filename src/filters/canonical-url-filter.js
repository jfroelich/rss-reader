'use strict';

// import rbl.js
// import url-utils.js
// import dom.js

const CANONICAL_URL_FILTER_MAP = {
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

// @throws AssertionError
function canonicalURLFilter(doc, baseURL) {
  assert(doc instanceof Document);
  assert(URLUtils.isURL(baseURL));

  const srcSelector = canonicalURLFilterCreateSelector();

  const srcElements = doc.querySelectorAll(srcSelector);
  for(const srcElement of srcElements) {
    canonicalURLFilterResolveAttribute(srcElement, baseURL);
  }

  if(doc.body) {
    const srcsetElements = doc.body.querySelectorAll('img[srcset], source[srcset]');
    for(const srcsetElement of srcsetElements) {
      canonicalURLFilterResolveSrcset(srcsetElement, baseURL);
    }
  }
}

function canonicalURLFilterCreateSelector() {
  const tags = Object.keys(CANONICAL_URL_FILTER_MAP);
  const parts = [];
  for(const tag of tags) {
    parts.push(`${tag}[${CANONICAL_URL_FILTER_MAP[tag]}]`);
  }
  return parts.join(',');
}

function canonicalURLFilterResolveAttribute(element, baseURL) {
  const attributeName = CANONICAL_URL_FILTER_MAP[element.localName];
  if(!attributeName) {
    return;
  }

  const originalURLString = element.getAttribute(attributeName);
  if(!originalURLString) {
    return;
  }

  const resolvedURL = URLUtils.resolve(originalURLString, baseURL);
  if(!resolvedURL) {
    return;
  }

  if(resolvedURL.href.length !== originalURLString.length) {
    element.setAttribute(attributeName, resolvedURL.href);
  }
}

function canonicalURLFilterResolveSrcset(element, baseURL) {
  const srcsetAttributeValue = element.getAttribute('srcset');
  const descriptors = domSrcsetParseFromString(srcsetAttributeValue);

  let changeCount = 0;
  for(const descriptor of descriptors) {
    const resolvedURL = URLUtils.resolve(descriptor.url, baseURL);
    if(resolvedURL && resolvedURL.href.length !== descriptor.url.length) {
      descriptor.url = resolvedURL.href;
      changeCount++;
    }
  }

  if(changeCount) {
    const newValue = domSrcsetSerialize(descriptors);
    if(newValue) {
      element.setAttribute('srcset', newValue);
    }
  }
}
