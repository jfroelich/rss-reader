import assert from "/src/common/assert.js";

// These constraints are rather arbitrary, but just as a general bound
// TODO: increase accuracy
export const MIME_TYPE_MIN_LENGTH = 7;
export const MIME_TYPE_MAX_LENGTH = 100;

// Returns a normalized mime type from a content type. Tolerant of bad input.
// @param contentType {String} an http response header value, optional
// @returns {String} a mime type, or undefined if error
export function fromContentType(contentType) {
  if(typeof contentType !== 'string') {
    console.debug('Content type not a defined string', typeof contentType);
    return;
  }

  if(contentType.length < 1) {
    console.debug('Zero length content type before trim');
    return;
  }

  contentType = contentType.trim();
  if(contentType.length < 1) {
    console.debug('Zero length content type after trim');
    return;
  }

  if(contentType.length < MIME_TYPE_MIN_LENGTH) {
    console.debug('Content type length too short', contentType);
    return;
  }

  // Check for and strip ';charset=encoding'
  const scpos = contentType.indexOf(';');
  let mimeType = scpos > -1 ? contentType.substring(0, scpos) : contentType;

  if(mimeType.length < MIME_TYPE_MIN_LENGTH) {
    console.debug('Mime type is too short', mimeType);
    return;
  }

  // Normalize output
  mimeType = filterWhitespace(mimeType).toLowerCase();

  if(!isMimeType(mimeType)) {
    console.debug('Mime type is not well-formed', mimeType);
    return;
  }

  return mimeType;
}

function filterWhitespace(string) {
  return string.replace(/\s+/g, '');
}

// A basic trivial test of whether the parameter represents a mime type. Inaccurate. Few false
// negatives but many false positives.
export function isMimeType(value) {
  return typeof value === 'string' && value.length > MIME_TYPE_MIN_LENGTH &&
    value.length < MIME_TYPE_MAX_LENGTH && value.includes('/') &&
    !value.includes(' ');
}
