import assert from "/src/assert/assert.js";
import * as MimeUtils from "/src/mime/utils.js";

// Return true if url probably represents a binary resource. This is shallow in the sense that it
// does not actually investigate the bytes of the resource, nor does it fetch the resource. This
// sniffer looks purely at the url itself.
export default function isBinaryURL(url) {
  assert(url instanceof URL);

  // Check if the url's protocol indicates it cannot be binary. This is the fastest and simplest
  // check so do it first.
  // TODO: make exhaustive
  const textProtocols = ['tel:', 'mailto:', 'javascript:'];
  if(textProtocols.includes(url.protocol)) {
    return false;
  }

  // Special handling for data uris
  if(url.protocol === 'data:') {
    const mimeType = findMimeTypeInDataURL(url);
    return mimeType ? MimeUtils.isBinary(mimeType) : true;
  }

  const extension = getExtensionFromURL(url);
  const mimeType = MimeUtils.getTypeForExtension(extension);
  return mimeType ? MimeUtils.isBinary(mimeType) : false;
}

// Extracts the mime type of a data uri as string. Returns undefined if not found or invalid.
function findMimeTypeInDataURL(url) {
  const href = url.href;

  // If the url is too short to even contain the mime type, fail.
  if(href.length < MimeUtils.MIME_TYPE_MIN_LENGTH) {
    return;
  }

  const PREFIX_LENGTH = 'data:'.length;

  // Limit the scope of the search
  const haystack = href.substring(PREFIX_LENGTH, PREFIX_LENGTH + MimeUtils.MIME_TYPE_MAX_LENGTH);

  const semicolonPosition = haystack.indexOf(';');
  if(semicolonPosition < 0) {
    return;
  }

  const mimeType = haystack.substring(0, semicolonPosition);
  if(MimeUtils.isMimeType(mimeType)) {
    return mimeType;
  }
}

// Given a url, return the extension of the filename component of the path component. Return
// undefined if no extension found. The returned string excludes the leading '.'.
// @returns {String}
function getExtensionFromURL(url) {
  // Approximate path min length '/.b'
  const minlen = 3;
  // Approximate extension max length excluding '.'
  const maxlen = 255;
  const path = url.pathname;
  const pathlen = path.length;

  if(pathlen >= minlen) {
    const lastDotPos = path.lastIndexOf('.');
    if((lastDotPos >= 0) && (lastDotPos + 1 < pathlen)) {
      const ext = path.substring(lastDotPos + 1);
      if(ext.length <= maxlen && isAlphanumeric(ext)) {
        return ext;
      }
    }
  }
}

// From the start of the string to its end, if one or more of the characters is not in the class of
// alphanumeric characters, then the string is not alphanumeric.
// See https://stackoverflow.com/questions/4434076
// See https://stackoverflow.com/questions/336210
// The empty string is true, null/undefined are true
// Does NOT support languages other than English
function isAlphanumeric(string) {
  return /^[a-zA-Z0-9]*$/.test(string);
}
