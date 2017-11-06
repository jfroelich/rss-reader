'use strict';

// import rbl.js
// import net/mime.js

// TODO: impose length cap on url strings

const URLUtils = {};

// Allows for leading whitespace characters. Returns true for javascript: and
// mailto: and data:. Returns true for https:// and http://. Returns false for
// '//' (which is preferable).
// @param url {String} input url
// @returns {Boolean} true if the url is canonical, otherwise false
URLUtils.isCanonical = function(url) {
  assert(typeof url === 'string');
  return /^\s*[a-z]+:/i.test(url);
};

// A url must be at least this long to be a script url
URLUtils.MIN_SCRIPT_LENGTH = 'javascript:'.length;

// Returns true if the url has the 'javascript:' protocol. Does not throw in
// the case of bad input.
// @param url {String}
// @returns {Boolean}
URLUtils.hasScriptProtocol = function(url) {
  return typeof url === 'string' &&
    url.length > URLUtils.MIN_SCRIPT_LENGTH &&
    /^\s*javascript:/i.test(url);
};

// Returns the absolute form the input url
// @param url {String}
// @param baseURL {URL}
// @returns {URL} the absolute url, or undefined if an error occurred
URLUtils.resolve = function(url, baseURL) {
  assert(typeof url === 'string');
  assert(baseURL instanceof URL);

  let canonicalURL;
  try {
    canonicalURL = new URL(url, baseURL);
  } catch(error) {
  }
  return canonicalURL;
};

// @param url {String}
// @returns {String}
URLUtils.getHostname = function(url) {
  assert(typeof url === 'string');
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch(error) {
  }
};

// Only minor validation for speed. Tolerates bad input.
// Assumes canonical url
// @param url {String}
// @returns {Boolean}
URLUtils.isValid = function(url) {
  const MIN_LENGTH = 1;
  if(typeof url === 'string') {
    url = url.trim();
    if(url.length >= MIN_LENGTH) {
      return !url.includes(' ');
    }
  }
  return false;
};

// Returns true if the input string appears to be a valid path
// @param path {String} a path component of a url
// @returns {Boolean} true if the path appears valid, otherwise false
URLUtils.isValidPath = function(path) {
  return typeof path === 'string' &&
    path.length > 0 &&
    path.charAt(0) === '/' &&
    !path.includes(' ');
};

// TODO: test input 'foo.', I suspect it is incorrect
// TODO: revert to accepting {URL} as input
// @param path {String}
// @returns {String}
URLUtils.getExtensionFromPath = function(path) {
  assert(URLUtils.isValidPath(path));

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
};

// Return true if url probably represents a binary resource
// @param url {URL} url object
URLUtils.sniffIsBinary = function(url) {
  assert(URLUtils.isURL(url));

  // Assume data url objects are probably non binary
  if(url.protocol === 'data:') {
    return false;
  }

  const path = url.pathname;
  const extension = URLUtils.getExtensionFromPath(path);
  if(!extension) {
    return false;
  }

  const mimeType = mime.getTypeForExtension(extension);
  if(!mimeType) {
    return false;
  }

  return mime.isBinary(mimeType);
};

// Returns a file name without its extension (and without the '.')
URLUtils.filterExtensionFromFileName = function(fileName) {
  assert(typeof fileName === 'string');
  const index = fileName.lastIndexOf('.');
  return index < 0 ? fileName : fileName.substring(0, index);
};

// TODO: revert to accepting URL as input
URLUtils.getFileNameFromPath = function(path) {
  assert(URLUtils.isValidPath(path));
  const index = path.lastIndexOf('/');
  if(index > -1) {
    const indexPlus1 = index + 1;
    if(indexPlus1 < path.length) {
      return path.substring(indexPlus1);
    }
  }
  return path;
};

// Returns true if value is a URL object
URLUtils.isURL = function(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
};

// Compares two urls for equality, after normalization and removing the hash
// from each url, if present. Both urls must be defined strings.
// @param url1 {String}
// @param url2 {String}
// @throws {Error} if either url is not a valid url
// @returns Boolean
// TODO: change to accepting URL objects only
URLUtils.hashlessEquals = function(url1, url2) {
  assert(typeof url1 === 'string');
  assert(typeof url2 === 'string');

  // Unmarshalling enables normalization and simple hash filtering
  // Allow url parsing errors to bubble.
  const urlObject1 = new URL(url1);
  const urlObject2 = new URL(url2);
  urlObject1.hash = '';
  urlObject2.hash = '';
  return urlObject1.href === urlObject2.href;
};
