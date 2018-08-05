import * as string from '/src/lib/string.js';

// From this module's point of view, a mime-type is a specialized type of
// string. Therefore, there is no explicit data type, just helpers that work
// with strings that purport to be mime types.

export const MIME_TYPE_MIN_LENGTH = 7;
export const MIME_TYPE_MAX_LENGTH = 100;

// Extracts the mime type of an HTTP Content-Type header. Rather than throw when
// input is invalid, this simply returns undefined, for convenience.
export function parse_content_type(content_type) {
  if (typeof content_type !== 'string') {
    return;
  }

  if (content_type.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  content_type = content_type.trim();
  if (content_type.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  const scpos = content_type.indexOf(';');
  let mime_type = scpos > -1 ? content_type.substring(0, scpos) : content_type;
  if (mime_type.length >= MIME_TYPE_MIN_LENGTH) {
    mime_type = normalize(mime_type);
    if (is_mime_type(mime_type)) {
      return mime_type;
    }
  }
}

function normalize(mime_type) {
  return string.filter_whitespace(mime_type).toLowerCase();
}


// Returns whether a string represents a mime type. This is inaccurate. This
// only provides a loose guarantee that a string looks like a mime type.
export function is_mime_type(value) {
  return typeof value === 'string' && value.length > MIME_TYPE_MIN_LENGTH &&
      value.length < MIME_TYPE_MAX_LENGTH && value.includes('/') &&
      !value.includes(' ');
}
