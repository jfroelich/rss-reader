import assert from "/src/assert/assert.js";
import isAlphanumeric from "/src/string/is-alphanumeric.js";
import * as MimeUtils from "/src/mime/utils.js";

// Return true if url probably represents a binary resource. This is shallow in the sense that it
// does not actually investigate the bytes of the resource, nor does it fetch the resource. This
// sniffer looks purely at the url itself.
export default function isBinaryURL(url) {
  assert(url instanceof URL);
  if(url.protocol === 'data:') {
    return isBinaryDataURL(url);
  }
  return !hasTextProtocol(url) && hasBinaryExtension(url);
}

// Returns whether the data uri represents a binary resource
function isBinaryDataURL(url) {
  const mimeType = findMimeTypeInDataURL(url);
  if(mimeType) {
    return MimeUtils.isBinary(mimeType);
  }

  // Assume data url objects with unclear mime type are probably binary
  return true;
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

// Protocols which are known to be text
// TODO: make exhaustive
// TODO: do not repeat the ':', caller should strip it
const TEXT_PROTOCOLS = [
  'tel:', 'mailto:', 'javascript:'
];

function hasTextProtocol(url) {
  return TEXT_PROTOCOLS.includes(url.protocol);
}

function hasBinaryExtension(url) {
  const extension = getExtensionFromURL(url);
  if(extension) {
    const mimeType = MimeUtils.getTypeForExtension(extension);
    if(mimeType) {
      return MimeUtils.isBinary(mimeType);
    }
  }

  return false;
}

const PATH_WITH_EXTENSION_MIN_LENGTH = 3; // '/.b'
const EXTENSION_MAX_LENGTH = 255; // excluding '.'

// Given a url, return the extension of the filename component of the path component. Return
// undefined if no extension found. The returned string excludes the leading '.'.
// @returns {String}
function getExtensionFromURL(url) {

  // There is no need to first get the file name then get the extension. If there is a dot in a
  // directory part of the path, there is still a trailing slash before the file name, which is not
  // alphanumeric. If there is both a dot in a directory and a dot in the file name, the dot in the
  // directory is not the last dot.

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
