'use strict';

// import net/mime-utils.js

// TODO: impose length cap on url strings
// TODO: split into URLStringUtils and URLUtils ?

// Allows for leading whitespace characters. Returns true for javascript: and
// mailto: and data:. Returns true for https:// and http://. Returns false for
// '//' (which is preferable).
// @param url {String} input url
// @returns {Boolean} true if the url is canonical, otherwise false
function urlIsCanonical(url) {
  console.assert(typeof url === 'string');
  return /^\s*[a-z]+:/i.test(url);
}

// A url must be at least this long to be a script url
const URL_MIN_SCRIPT_LENGTH = 'javascript:'.length;

// Returns true if the url has the 'javascript:' protocol. Does not throw in
// the case of bad input.
// @param url {String}
// @returns {Boolean}
function urlHasScriptProtocol(url) {
  return typeof url === 'string' &&
    url.length > URL_MIN_SCRIPT_LENGTH &&
    /^\s*javascript:/i.test(url);
}

// Returns the absolute form the input url
// @param url {String}
// @param baseURL {URL}
// @returns {URL} either the input url as an object if the url was already
// absolute, or the absolute url, or undefined if a parsing error occurred
function urlResolve(url, baseURL) {
  console.assert(typeof url === 'string');
  console.assert(urlIsURL(baseURL));

  let canonicalURL;

  if(urlIsCanonical(url)) {
    try {
      canonicalURL = new URL(url);
    } catch(error) {
    }
    return canonicalURL;
  }

  try {
    canonicalURL = new URL(url, baseURL);
  } catch(error) {
  }
  return canonicalURL;
}

// @param url {String}
// @returns {String}
function urlGetHostname(url) {
  console.assert(typeof url === 'string');
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch(error) {
  }
}

// Only minor validation for speed. Tolerates bad input.
// Assumes canonical url
// @param url {String}
// @returns {Boolean}
function urlIsValid(url) {
  const URL_MIN_LENGTH = 1;

  if(typeof url === 'string') {
    url = url.trim();
    if(url.length >= URL_MIN_LENGTH) {
      return !url.includes(' ');
    }
  }
  return false;
}

// Returns true if the input string appears to be a valid path
// @param path {String} a path component of a url
// @returns {Boolean} true if the path appears valid, otherwise false
function urlPathIsValid(path) {
  return typeof path === 'string' &&
    path.length > 0 &&
    path.charAt(0) === '/' &&
    !path.includes(' ');
}

// TODO: test input 'foo.', I suspect it is incorrect
// @param path {String}
// @returns {String}
function urlPathGetExtension(path) {
  console.assert(urlPathIsValid(path));

  // Fail if the path is probably too short to contain an extension
  const MIN_PATH_LENGTH = '/a.b'.length;
  if(path.length < MIN_PATH_LENGTH) {
    return;
  }

  const lastDotPosition = path.lastIndexOf('.');
  if(lastDotPosition === -1) {
    return;
  }

  // A path that ends with a period is a valid path.
  // The +1 skips past the period itself.
  // TODO: this should avoid out of bounds error? What if dot is final position?
  let extension = path.substring(lastDotPosition + 1);

  // If the path ended with a dot, then the extension string will be
  // empty, so assume the path is malformed and no extension exists
  // TODO: does this make sense if I avoid the case above?
  if(!extension) {
    return;
  }

  const MAX_EXTENSION_LENGTH = 4;
  if(extension.length > MAX_EXTENSION_LENGTH) {
    return;
  }

  extension = extension.toLowerCase();
  if(!/[a-z]/.test(extension)) {
    return;
  }

  return extension;
}

// Return true if url probably represents a binary resource. This does not
// actually inspect the bytes of the resource. This makes a guess based on the
// extension of the file name in the url.
// @param url {URL} url object
// @returns {Boolean} true if probably binary, otherewise false
function urlSniffIsBinary(url) {
  console.assert(urlIsURL(url));

  // Assume data url objects are probably non binary
  if(url.protocol === 'data:') {
    return false;
  }

  const path = url.pathname;
  const extension = urlPathGetExtension(path);
  if(!extension) {
    return false;
  }

  const mimeType = MIMEUtils.getTypeForExtension(extension);
  if(!mimeType) {
    return false;
  }

  return MIMEUtils.isBinary(mimeType);
}

// Returns a file name without its extension (and without the '.')
function urlFileNameFilterExtension(fileName) {
  const index = fileName.lastIndexOf('.');
  return index < 0 ? fileName : fileName.substring(0, index);
}

function urlPathGetFileName(path) {
  console.assert(urlPathIsValid(path));
  const index = path.lastIndexOf('/');
  if(index > -1) {
    const indexPlus1 = index + 1;
    if(indexPlus1 < path.length) {
      return path.substring(indexPlus1);
    }
  }
  return path;
}

// Returns true if value is a URL object
function urlIsURL(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}

// Compares two urls for equality, after normalization and removing the hash
// from each url, if present. Both urls must be defined strings.
// @param url1 {String}
// @param url2 {String}
// @throws {Error} if either url is not a valid url
// @returns Boolean
function urlEqualsNoHash(url1, url2) {
  console.assert(typeof url1 === 'string');
  console.assert(typeof url2 === 'string');

  // Unmarshalling enables normalization and simple hash filtering
  // Allow url parsing errors to bubble.
  const urlObject1 = new URL(url1);
  const urlObject2 = new URL(url2);
  urlObject1.hash = '';
  urlObject2.hash = '';
  return urlObject1.href === urlObject2.href;
}
