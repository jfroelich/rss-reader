// Utilities for working with URL objects and url-like strings

import {assert} from "/src/assert.js";
import {mime} from "/src/mime.js";
import {parseInt10} from "/src/number.js";
import {isAlphanumeric} from "/src/string.js";


// Returns true if otherURL is 'external' to the documentURL. Inaccurate and
// insecure.
// @param documentURL {URL}
// @param otherURL {URL}
// @throws AssertionError
// @return {Boolean}
export function isExternalURL(documentURL, otherURL) {
  const docDomain = urlGetUpperDomain(documentURL);
  const otherDomain = urlGetUpperDomain(otherURL);
  return docDomain !== otherDomain;
}

// Returns the 1st and 2nd level domains as a string. Basically hostname
// without subdomains. This only does minimal symbolic validation of values,
// and is also inaccurate and insecure.
function urlGetUpperDomain(url) {
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

  // This isn't meant to be super accurate or professional. Using the full list
  // from https://publicsuffix.org/list/public_suffix_list.dat is overkill.
  // As a compromise, just look at tld character count.

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

// Allows for leading whitespace characters. Returns true for javascript: and
// mailto: and data:. Returns true for https:// and http://. Returns false for
// '//'.
// @param url {String} input url
// @returns {Boolean} true if the url is canonical, otherwise false
export function isCanonicalURL(url) {
  assert(typeof url === 'string');
  return /^\s*[a-z]+:/i.test(url);
}

// A url must be at least this long to be a script url
const URL_MIN_SCRIPT_LENGTH = 'javascript:'.length;

// Returns true if the url has the 'javascript:' protocol. Does not throw in
// the case of bad input.
// @param url {String}
// @returns {Boolean}
export function hasScriptProtocol(url) {
  return typeof url === 'string' &&
    url.length > URL_MIN_SCRIPT_LENGTH &&
    /^\s*javascript:/i.test(url);
}

// Returns the absolute form the input url
// @param url {String}
// @param baseURL {URL}
// @returns {URL} the absolute url, or undefined if an error occurred
export function resolveURL(url, baseURL) {
  assert(typeof url === 'string');
  assert(baseURL instanceof URL);

  let canonicalURL;
  try {
    canonicalURL = new URL(url, baseURL);
  } catch(error) {
  }
  return canonicalURL;
}

// TODO: is this still in use? should probably deprecate and have caller work with a URL
// object explicitly
// @param url {String}
// @returns {String}
export function urlGetHostname(url) {
  assert(typeof url === 'string');
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch(error) {
  }
}

const URL_MAX_LENGTH_EXCLUSIVE = 3000;
const URL_MIN_LENGTH_INCLUSIVE = 1;

// Only minor validation for speed. Tolerates bad input. This isn't intended to be the most
// accurate classification. Instead, it is intended to easily find bad urls and rule them out as
// invalid, even though some slip through, and not unintentionally rule out good urls.
// @param url {String}
// @returns {Boolean}
export function isValidURL(url) {
  if(typeof url === 'string') {
    url = url.trim();
    if(url.length < URL_MAX_LENGTH_EXCLUSIVE && url.length >= URL_MIN_LENGTH_INCLUSIVE) {
      return !url.includes(' ');
    }
  }
  return false;
}

const URL_PATH_WITH_EXTENSION_MIN_LENGTH = 3; // '/.b'
const URL_EXTENSION_MAX_LENGTH = 255; // excluding '.'

// @param url {URL}
// @returns {String}
function getExtensionFromURL(url) {
  assert(url instanceof URL);

  // It is counterintuitive at first glance but there is no need to first get the file name
  // then get the extension. If there is a dot in a directory part of the path, there is still
  // a trailing slash before the file name, which is not alphanumeric. If there is both a dot in
  // a directory and a dot in the file name, the dot in the directory is not the last dot.

  if(url.pathname.length >= URL_PATH_WITH_EXTENSION_MIN_LENGTH) {
    const lastDotPos = url.pathname.lastIndexOf('.');
    if((lastDotPos >= 0) && (lastDotPos + 1 < url.pathname.length)) {
      const ext = url.pathname.substring(lastDotPos + 1); // exclude '.'
      if(ext.length <= URL_EXTENSION_MAX_LENGTH && isAlphanumeric(ext)) {
        return ext;
      }
    }
  }
}

// Return true if url probably represents a binary resource
// @param url {URL}
// @throws {AssertionError}
export function sniffIsBinaryURL(url) {
  assert(url instanceof URL);

  if(url.protocol === 'data:') {
    const mimeType = findMimeTypeInDataURL(url);
    if(mimeType) {
      return mime.isBinary(mimeType);
    } else {
      // Assume data url objects are probably binary
      return true;
    }
  }

  const extension = getExtensionFromURL(url);
  if(extension) {
    const mimeType = mime.getTypeForExtension(extension);
    if(mimeType) {
      return mime.isBinary(mimeType);
    }
  }

  return false;
}

function findMimeTypeInDataURL(dataURL) {
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

// Compares two urls for equality without considering hash values
// @param url1 {URL}
// @param url2 {URL}
// @throws {AssertionError} if either parameter is not a URL
// @return {Boolean} true if equal
export function compareURLsWithoutHash(url1, url2) {
  assert(url1 instanceof URL);
  assert(url2 instanceof URL);

  // Create clones of each url so that we can mutate the hash property without
  // causing unexpected side effects on the input in the calling context.
  const modURL1 = new URL(url1.href);
  const modURL2 = new URL(url2.href);
  modURL1.hash = '';
  modURL2.hash = '';
  return modURL1.href === modURL2.href;
}
