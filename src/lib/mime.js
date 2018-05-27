import {filter_whitespace} from '/src/lib/lang/filter-whitespace.js';

// Provides utilities for working with mime types. From this module's point of
// view, a mime-type value is a specialized form of a string. Therefore, there
// is no explicit data type, just helpers that work with strings that purport to
// be mime types.

// * `parse_content_type` extracts the mime type of an HTTP `Content-Type`
// header.
// * `is_mime_type` returns whether a string represents a mime type.

// ### parse_content_type notes
// Rather than throw when input is invalid, this simply returns undefined, for
// convenience.

// ### is_mime_type notes
// This is inaccurate. This only provides a loose guarantee that a string looks
// like a mime type.

// # TODO: increase the accuracy of min/max constants
// The current values are rather arbitrary. They provide some bounds to allow
// for early exits during parsing and to quickly check validity based on length.
// Eventually I would like these values to have a sounder basis. Currently the
// values are just based on an arm's length view of the typical mime values I've
// personally observed using shoddy empirical evidence.

// # TODO: make `is_mime_type` more strict
// * Do not allow `foo/bar/baz`
// * There should only be one slash allowed.

// # TODO: document and record that law I came across about tolerating sloppy
// input but producing nice output and cite as a design philosophy, postel's
// law?

export const MIME_TYPE_MIN_LENGTH = 7;
export const MIME_TYPE_MAX_LENGTH = 100;

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
  return filter_whitespace(mime_type).toLowerCase();
}

export function is_mime_type(value) {
  return typeof value === 'string' && value.length > MIME_TYPE_MIN_LENGTH &&
      value.length < MIME_TYPE_MAX_LENGTH && value.includes('/') &&
      !value.includes(' ');
}
