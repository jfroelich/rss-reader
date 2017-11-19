// Utilities for working with URL objects. All functions that accept a url parameter expect the
// parameter to be of type URL, not String, unless otherwise specified.

import assert from "/src/utils/assert.js";
import * as mime from "/src/mime-utils.js";
import {isAlphanumeric, parseInt10} from "/src/utils/string.js";

// This disaster of a function tries to clearly expose the risk of setting a URL's href property
// directly. Whenever there is any doubt about whether the new href value is valid, this function
// should be used to set the href property instead of directly setting the property. The risk of
// setting the href property directly is that the href setter implementation, at least in Chrome's
// implementation, does not appear to undergo the same checks as the URL constructor. Casually, I
// and probably other users of the URL object assume the behavior would be the same, and that the
// URL object warrants it cannot contain invalid values. But this is not true. While the constructor
// throws an error when an invalid parameter is given, the href setter does NOT. The href setter
// merrily ignores the validity of the new value. This function imposes the same constraint on
// the setter that is used by the constructor, that the URL cannot store an invalid URL.
//
// According to https://url.spec.whatwg.org/#dom-url-href, the setter should throw a TypeError.
// Currently Chrome does not appear to do this. This behavior is easily reproduced by setting
// the href property directly to garbage.
export function setURLHrefProperty(url, newHrefString) {
  // Because setting href does not throw the expected type error, instead, use a proxy that involves
  // passing through the constructor, which will throw an error of some kind if the url is invalid.
  const guardURL = new URL(newHrefString);
  // Then set the href value. Notably, there is NO guarantee that guardURL.href is equal to
  // newHrefString. It very likely may not be equal. However, rather than setting href to
  // newHrefString, I want href values to be consistent, so set it to the serialized guard value
  // instead. Maybe that isn't important because both serialize to the same thing? Without knowing
  // or bothering to test, I am going to assume using the guard value is safer and more consistent.
  url.href = guardURL.href;
}

// Returns true if otherURL is 'external' to the documentURL. Inaccurate and insecure.
export function isExternalURL(documentURL, otherURL) {

  // Certain protocols are never external in the sense that a network request is not performed
  switch(otherURL.protocol) {
  case 'data:':
  case 'mailto:':
  case 'javascript:':
    return false;
  default:
    break;
  }

  const docDomain = getUpperDomain(documentURL);
  const otherDomain = getUpperDomain(otherURL);
  return docDomain !== otherDomain;
}

// Returns the 1st and 2nd level domains as a string. Basically hostname without subdomains. This
// only does minimal symbolic validation of values, and is also inaccurate and insecure.
function getUpperDomain(url) {
  assert(url instanceof URL);

  // Treat IP as whole
  if(isIPv4Address(url.hostname) || isIPv6Address(url.hostname)) {
    return url.hostname;
  }

  const levels = url.hostname.split('.');

  // Handle the simple case of 'localhost'
  if(levels.length === 1) {
    return url.hostname;
  }

  // Handle the simple case of 'example.com'
  if(levels.length === 2) {
    return url.hostname;
  }

  // This isn't meant to be super accurate or professional. Using the full list from
  // https://publicsuffix.org/list/public_suffix_list.dat is overkill. As a compromise, just look
  // at tld character count.
  const level1 = levels[levels.length - 1];
  if(level1.length === 2) {
    // Infer it is ccTLD, return levels 3 + 2 + 1
    const usedLevels = levels.slice(-3);
    return usedLevels.join('.');
  } else {
    // Infer it is gTLD, returns levels 2 + 1
    const usedLevels = levels.slice(-2);
    return usedLevels.join('.');
  }
}

function isIPv4Address(string) {
  if(typeof string !== 'string') {
    return false;
  }

  const parts = string.split('.');
  if(parts.length !== 4) {
    return false;
  }

  for(const part of parts) {
    const digit = parseInt10(part);
    if(isNaN(digit) || digit < 0 || digit > 255) {
      return false;
    }
  }

  return true;
}

// Expects a hostname string property value from a URL object.
function isIPv6Address(hostname) {
  return typeof hostname === 'string' && hostname.includes(':');
}

const PATH_WITH_EXTENSION_MIN_LENGTH = 3; // '/.b'
const EXTENSION_MAX_LENGTH = 255; // excluding '.'

// @returns {String}
function getExtension(url) {
  assert(url instanceof URL);

  // It is counterintuitive at first glance but there is no need to first get the file name
  // then get the extension. If there is a dot in a directory part of the path, there is still
  // a trailing slash before the file name, which is not alphanumeric. If there is both a dot in
  // a directory and a dot in the file name, the dot in the directory is not the last dot.

  if(url.pathname.length >= PATH_WITH_EXTENSION_MIN_LENGTH) {
    const lastDotPos = url.pathname.lastIndexOf('.');
    if((lastDotPos >= 0) && (lastDotPos + 1 < url.pathname.length)) {
      const ext = url.pathname.substring(lastDotPos + 1); // exclude '.'
      if(ext.length <= EXTENSION_MAX_LENGTH && isAlphanumeric(ext)) {
        return ext;
      }
    }
  }
}

// Return true if url probably represents a binary resource
export function sniffIsBinaryURL(url) {
  assert(url instanceof URL);

  if(url.protocol === 'data:') {
    const mimeType = findMimeTypeInData(url);
    if(mimeType) {
      return mime.isBinary(mimeType);
    } else {
      // Assume data url objects are probably binary
      return true;
    }
  }

  switch(url.protocol) {
  case 'mailto:':
  case 'javascript:':
    return false;
  default:
    break;
  }

  const extension = getExtension(url);
  if(extension) {
    const mimeType = mime.getTypeForExtension(extension);
    if(mimeType) {
      return mime.isBinary(mimeType);
    }
  }

  return false;
}

function findMimeTypeInData(dataURL) {
  assert(dataURL instanceof URL);
  assert(dataURL.protocol === 'data:');

  const href = dataURL.href;

  // If the url is too short to even contain the mime type, fail.
  if(href.length < mime.MIME_TYPE_MIN_LENGTH) {
    return;
  }

  const PREFIX_LENGTH = 'data:'.length;

  // Limit the scope of the search
  const haystack = href.substring(PREFIX_LENGTH, PREFIX_LENGTH + mime.MIME_TYPE_MAX_LENGTH);

  const semicolonPosition = haystack.indexOf(';');
  if(semicolonPosition < 0) {
    return;
  }

  const mimeType = haystack.substring(0, semicolonPosition);
  if(mime.isMimeType(mimeType)) {
    return mimeType;
  }
}

// Returns a file name without its extension (and without the '.')
export function filterExtensionFromFileName(fileName) {
  assert(typeof fileName === 'string');
  const index = fileName.lastIndexOf('.');
  return index < 0 ? fileName : fileName.substring(0, index);
}

export function getFileNameFromURL(url) {
  assert(url instanceof URL);
  const index = url.pathname.lastIndexOf('/');
  if((index > -1) && (index + 1 < url.pathname.length)) {
    return url.pathname.substring(index + 1);
  }
}

// Returns whether the url has any credential information
export function isCredentialedURL(url) {
  assert(url instanceof URL);
  return url.username || url.password;
}

// Compares two urls for equality without considering hash values
// @param url1 {URL}
// @param url2 {URL}
// @return {Boolean} true if equal
export function compareURLsWithoutHash(url1, url2) {
  assert(url1 instanceof URL);
  assert(url2 instanceof URL);

  // Create clones of each url so that we can mutate the hash property without causing unexpected
  // side effects on the input in the calling context.
  const modURL1 = new URL(url1.href);
  const modURL2 = new URL(url2.href);
  modURL1.hash = '';
  modURL2.hash = '';
  return modURL1.href === modURL2.href;
}
