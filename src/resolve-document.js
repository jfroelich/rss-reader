// See license.md

'use strict';

const jrResolveDocumentAttributeMap = {
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

function jrResolveDocumentBuildSelectorPart(key) {
  return `${key}[${jrResolveDocumentAttributeMap[key]}]`;
}




function jrResolveDocument(documentObject, baseURLObject) {

  if(!jrUtilsIsURLObject(baseURLObject)) {
    throw new TypeError('baseURLObject should be of type URL');
  }

  const baseList = documentObject.querySelectorAll('base');
  for(let baseElement of baseList) {
    baseElement.remove();
  }

  const tagNameArray = Object.keys(jrResolveDocumentAttributeMap);
  const selectPartArray = tagNameArray.map(jrResolveDocumentBuildSelectorPart);
  const selectorString = selectPartArray.join(',');
  const elementList = documentObject.querySelectorAll(selectorString);
  for(let element of elementList) {
    jrResolveDocumentResolveMappedAttribute(element, baseURLObject);
  }

  const srcsetList = documentObject.querySelectorAll(
    'img[srcset], source[srcset]');
  for(let element of srcsetList) {
    jrResolveDocumentResolveSrcsetAttribute(element, baseURLObject);
  }
}

function jrResolveDocumentResolveMappedAttribute(element, baseURLObject) {
  const elementName = element.localName;
  const attributeName = jrResolveDocumentAttributeMap[elementName];
  if(!attributeName) {
    return;
  }

  const urlString = element.getAttribute(attributeName);
  if(!urlString) {
    return;
  }

  const resolvedURLObject = jrResolveDocumentResolveURL(urlString,
    baseURLObject);
  if(!resolvedURLObject) {
    return;
  }

  const resolvedURLString = resolvedURLObject.href;
  if(resolvedURLString !== urlString) {
    element.setAttribute(attributeName, resolvedURLString);
  }
}


function jrResolveDocumentResolveSrcsetAttribute(element, baseURLObject) {

  // The element has the attribute, but the attribute may not have a value.
  // parseSrcset requires a value or it may throw. While I catch exceptions
  // later I'd rather avoid exceptions where feasible
  const srcsetAttributeValue = element.getAttribute('srcset');
  if(!srcsetAttributeValue) {
    return;
  }

  let descriptorArray;
  try {
    descriptorArray = parseSrcset(srcsetAttributeValue);
  } catch(error) {
    console.warn(error);
    return;
  }

  // Working with 3rd party code so extra precaution
  if(!descriptorArray || !descriptorArray.length) {
    return;
  }


  // Resolve the urls of each descriptor. Set dirtied to true if at least
  // one url was resolved.
  let dirtied = false;
  for(let descriptor of descriptorArray) {
    const descriptorURLString = descriptor.url;
    const resolvedURLObject = jrResolveDocumentResolveURL(descriptorURLString,
      baseURLObject);

    if(!resolvedURLObject) {
      continue;
    }

    if(resolvedURLObject.href !== descriptorURLString) {
      dirtied = true;
      descriptor.url = resolvedURLObject.href;
    }
  }

  if(!dirtied) {
    return;
  }

  const newSrcsetAttributeValue = jrResolveDocumentSerializeSrcset(
    descriptorArray);

  if(newSrcsetAttributeValue) {
    element.setAttribute('srcset', newSrcsetAttributeValue);
  }

}

// @param descriptorArray {Array} an array of descriptor objects
function jrResolveDocumentSerializeSrcset(descriptorArray) {
  const outputArray = [];

  for(let descriptorObject of descriptorArray) {
    let stringArray = [descriptorObject.url];
    if(descriptorObject.d) {
      stringArray.push(' ');
      stringArray.push(descriptorObject.d);
      stringArray.push('x');
    } else if(descriptorObject.w) {
      stringArray.push(' ');
      stringArray.push(descriptorObject.w);
      stringArray.push('w');
    } else if(descriptorObject.h) {
      stringArray.push(' ');
      stringArray.push(descriptorObject.h);
      stringArray.push('h');
    }

    const descriptorString = stringArray.join('');
    outputArray.push(descriptorString);
  }

  const descriptorsString = outputArray.join(', ');
  return descriptorsString;
}

// Returns the absolute (aka canonical) form the input url
// @param urlString {String}
// @param baseURLObject {URL}
function jrResolveDocumentResolveURL(urlString, baseURLObject) {

  if(!jrUtilsIsURLObject(baseURLObject)) {
    throw new TypeError('baseURLObject must be of type URL');
  }

  // TODO: use a single regex for speed? Or maybe get the protocol,
  // normalize it, and check against a list of bad protocols?
  // TODO: or if it has any protocol, then just return the url as is?
  // - but that would still require a call to new URL
  // Or can we just check for the presence of any colon?
  if(/^\s*javascript:/i.test(urlString) ||
    /^\s*data:/i.test(urlString) ||
    /^\s*mailto:/i.test(urlString)) {
    return;
  }

  let absoluteURLObject;
  try {
    absoluteURLObject = new URL(urlString, baseURLObject);
  } catch(error) {
    console.warn(error, urlString, baseURLObject.href);
  }

  return absoluteURLObject;
}
