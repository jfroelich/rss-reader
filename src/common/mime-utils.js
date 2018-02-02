// These constraints are rather arbitrary, but just as a general bound
// TODO: increase accuracy
export const MIME_TYPE_MIN_LENGTH = 7;
export const MIME_TYPE_MAX_LENGTH = 100;

// Returns a normalized mime type from a content type. Tolerant of bad input.
// @param content_type {String} an http response header value, optional
// @returns {String} a mime type, or undefined if error
export function mime_type_from_content_type(content_type) {
  if (typeof content_type !== 'string') {
    return;
  }

  if (content_type.length < 1) {
    return;
  }

  content_type = content_type.trim();
  if (content_type.length < 1) {
    return;
  }

  if (content_type.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  // Check for and strip ';charset=encoding'
  const scpos = content_type.indexOf(';');
  let mime_type = scpos > -1 ? content_type.substring(0, scpos) : content_type;

  if (mime_type.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  // Normalize output
  mime_type = filter_whitespace(mime_type).toLowerCase();

  if (!is_mime_type(mime_type)) {
    return;
  }

  return mime_type;
}

function filter_whitespace(string) {
  return string.replace(/\s+/g, '');
}

// A trivial test of whether the parameter represents a mime type.
// Only partially accurate. Few false negatives but many false positives.
export function is_mime_type(value) {
  return typeof value === 'string' && value.length > MIME_TYPE_MIN_LENGTH &&
      value.length < MIME_TYPE_MAX_LENGTH && value.includes('/') &&
      !value.includes(' ');
}
