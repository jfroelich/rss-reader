// See license.md

'use strict';

{

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
  return `${key}[${urlAttrMap[key]}]`;
}

const selector = Object.keys(urlAttrMap).map(buildSelectorPart).join(',');

function resolveDocument(doc, log, baseURL) {
  log.log('Resolving document urls to base', baseURL.href);
  if(!parseSrcset) {
    throw new ReferenceError();
  }

  if(!isURLObject(baseURL)) {
    throw new TypeError('baseURL is not a URL');
  }

  const bases = doc.querySelectorAll('base');
  for(let base of bases) {
    base.remove();
  }

  const elements = doc.querySelectorAll(selector);
  for(let element of elements) {
    resolveMappedAttr(element, baseURL);
  }

  const srcsetEls = doc.querySelectorAll('img[srcset], source[srcset]');
  for(let element of srcsetEls) {
    resolveSrcsetAttr(element, baseURL);
  }
}

function resolveMappedAttr(element, baseURL) {
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
  if(resolvedURL && resolvedURL.href !== attrURL) {
    element.setAttribute(attrName, resolvedURL.href);
  }
}

function resolveSrcsetAttr(element, baseURL) {
  const attrURL = element.getAttribute('srcset');

  // The element has the attribute, but it may not have a value. parseSrcset
  // requires a value or it throws (??).
  if(!attrURL) {
    return;
  }

  const srcset = parseSrcset(attrURL);

  // The parseSrcset function may fail to parse (??)
  if(!srcset || !srcset.length) {
    return;
  }

  let dirtied = false;
  for(let descriptor of srcset) {
    const resolvedURL = resolveURL(descriptor.url, baseURL);
    if(resolvedURL && resolvedURL.href !== descriptor.url) {
      dirtied = true;
      descriptor.url = resolvedURL.href;
    }
  }

  if(dirtied) {
    const newSrcsetValue = serializeSrcset(srcset);
    if(newSrcsetValue) {
      element.setAttribute('srcset', newSrcsetValue);
    }
  }
}

function resolveURL(urlString, baseURL) {
  if(typeof urlString !== 'string') {
    throw new TypeError();
  }

  if(isJavascriptURL(urlString)) {
    return;
  }

  if(isObjectURL(urlString)) {
    return;
  }

  try {
    return new URL(urlString, baseURL);
  } catch(error) {
    console.warn(urlString, baseURL.href, error);
  }
}

function isObjectURL(urlString) {
  return /^\s*data:/i.test(urlString);
}

function isJavascriptURL(urlString) {
  return /^\s*javascript:/i.test(urlString);
}

// @param descriptors {Array} an array of basic descriptor objects such as the
// one produced by the parseSrcset library
function serializeSrcset(descriptors) {
  const output = [];
  for(let descriptor of descriptors) {
    let buf = [descriptor.url];
    if(descriptor.d) {
      buf.push(' ');
      buf.push(descriptor.d);
      buf.push('x');
    } else if(descriptor.w) {
      buf.push(' ');
      buf.push(descriptor.w);
      buf.push('w');
    } else if(descriptor.h) {
      buf.push(' ');
      buf.push(descriptor.h);
      buf.push('h');
    }
    output.push(buf.join(''));
  }
  return output.join(', ');
}

this.resolveDocument = resolveDocument;

}
