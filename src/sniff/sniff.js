import {is_mime_type, MIME_TYPE_MAX_LENGTH, MIME_TYPE_MIN_LENGTH} from '/src/mime/mime.js';

// Returns whether the url represents a binary resource. Note that the return
// value of false means either text or unknown; false does not mean only text.
export function url_is_binary(url) {
  if (!(url instanceof URL)) {
    throw new TypeError('Invalid url ' + url);
  }

  if (url.href === 'about:blank') {
    return false;
  }

  // Non-exhaustive
  const text_protocols = ['tel:', 'mailto:', 'javascript:'];
  if (text_protocols.includes(url.protocol)) {
    return false;
  }

  // Special handling for data uris
  if (url.protocol === 'data:') {
    // TODO: if text/plain is the default, that indicates non-binary. Why call
    // mime_type_is_binary? Why not just return false if
    // find_mime_type_in_data_url returns undefined? The logic remains the same
    // but involves one less function call in one of the two paths.

    const default_type = 'text/plain';
    const mime_type = find_mime_type_in_data_url(url) || default_type;
    return mime_type_is_binary(mime_type);
  }

  // TODO: the call to url_get_extension should be implicit in
  // find_mime_type_for_extension

  // If we cannot make a decision based on protocol, decide based on file
  // extension
  const extension = url_get_extension(url);
  if (!extension) {
    // We cannot confidently say it is binary so report it is not
    // TODO: I do not like how this implies that it is not-binary. This
    // potentially induces a false reliance. Perhaps url_is_binary should return
    // true, false, and indeterminate, and let the caller decide how to react
    return false;
  }

  const mime_type = find_mime_type_for_extension(extension);
  if (!mime_type) {
    // TODO: again, I do not like how this implies non-binary
    return false;
  }

  return mime_type_is_binary(mime_type);
}

// Return a mime type corresponding a file name extension
// @param extension {String}
// @returns {String} a mime type, or undefined on error or failed lookup
export function find_mime_type_for_extension(extension) {
  if (typeof extension === 'string') {
    return EXTENSION_TYPE_MAP[extension];
  }
}

// Extracts the mime type of a data uri. Returns undefined if not
// found or invalid.
export function find_mime_type_in_data_url(url) {
  if (!(url instanceof URL)) {
    throw new TypeError('Invalid url ' + url);
  }

  if (url.protocol !== 'data:') {
    throw new TypeError('Invalid data url ' + url.href);
  }

  // Capture the href and cache. The href getter is dynamic and a function,
  // similar to how array.length is a function. I do not trust that that the URL
  // implementation is smart enough to cache property access, at least for now.
  // This admittedly may be premature optimization, but I am overlooking that as
  // I remain ambivalent about its importance. What I am concerned about is
  // whether this is actually slower.
  const href = url.href;

  // If the url is too short to contain a mime type, fail.
  if (href.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  // Limit the scope of the string search space to starting after the protocol
  // ends, and up to the longest possible mime type that can be found, plus 1
  // for the trailing semicolon.
  const PREFIX_LENGTH = 'data:'.length;
  const search_start = PREFIX_LENGTH;
  const search_end = PREFIX_LENGTH + MIME_TYPE_MAX_LENGTH + 1;
  const haystack = href.substring(search_start, search_end);

  // Data uris that include a mime type include a delimiting semicolon after the
  // mime type.
  const sc_position = haystack.indexOf(';');

  // If we cannot find the ';' then conclude the mime type is not present
  if (sc_position < 0) {
    return;
  }

  // If we found a ';' that was located so close to the start that it is
  // impossible for the characters between start and ';' to represent a mime
  // type, then fail.
  if (sc_position < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  // Pluck the candidate characters from the search space. Note this is from the
  // search space, not the full data uri, which begins after the protocol
  const mime_type = haystack.substring(0, sc_position);

  // Finally, validate and return
  if (is_mime_type(mime_type)) {
    return mime_type;
  }
}

// Given a url, return the extension of the filename component of the path
// component. Return undefined if no extension found. The returned string
// excludes the leading '.'. This assumes the url uses English characters.
export function url_get_extension(url) {
  // Approximate path min length including the period is '/.b'
  const minlen = 3;
  // Approximate extension max length excluding the period
  const maxlen = 255;
  const path = url.pathname;
  const pathlen = path.length;

  if (pathlen >= minlen) {
    const last_dot_pos = path.lastIndexOf('.');
    if ((last_dot_pos >= 0) && (last_dot_pos + 1 < pathlen)) {
      const ext = path.substring(last_dot_pos + 1);
      if (ext.length <= maxlen && string_is_alphanumeric(ext)) {
        return ext;
      }
    }
  }
}

// Returns whether the string is alphanumeric. Counter-intuitively, this works
// by testing for the presence of any non-alphanumeric character.
// See https://stackoverflow.com/questions/4434076
// See https://stackoverflow.com/questions/336210
// The empty string is true, null/undefined are true
// Does NOT support languages other than English
export function string_is_alphanumeric(string) {
  return /^[a-zA-Z0-9]*$/.test(string);
}

// Returns whether the mime type is binary
export function mime_type_is_binary(mime_type) {
  if (!is_mime_type(mime_type)) {
    throw new TypeError('Invalid mime_type ' + mime_type);
  }

  // This algorithm assumes that mime types with the 'application' supertype are
  // binary unless the subtype is one of the following. The following list is
  // not exhaustive, but it covers most of the cases this app is interested in,
  // which is about fetching xml files.

  // clang-format off
  const application_text_types = [
    'application/atom+xml',
    'application/javascript',
    'application/json',
    'application/rdf+xml',
    'application/rss+xml',
    'application/vnd.mozilla.xul+xml',
    'application/xhtml+xml',
    'application/xml'
  ];
  // clang-format on

  const slash_position = mime_type.indexOf('/');
  const super_type = mime_type.substring(0, slash_position);

  switch (super_type) {
    case 'application': {
      return !application_text_types.includes(mime_type);
    }
    case 'text':
      return false;
    case 'audio':
      return true;
    case 'image':
      return true;
    case 'video':
      return true;
    case 'multipart':
      return true;
    default:
      // As I am not sure this is an exhaustive list of super types, and I do
      // not really care if it is, reaching the default case does not represent
      // an error
      return false;
  }
}

// A mapping of common file extensions to corresponding mime types. I've tried
// to pick standardized mime types but unfortunately there does not appear to be
// much of a standard.
export const EXTENSION_TYPE_MAP = {
  ai: 'application/postscript',
  aif: 'audio/aiff',
  atom: 'application/atom+xml',
  avi: 'video/avi',
  bin: 'application/octet-stream',
  bmp: 'image/bmp',
  c: 'text/plain',
  cc: 'text/plain',
  cgi: 'text/html',
  'class': 'application/java',
  com: 'application/octet-stream',
  cpp: 'text/plain',
  css: 'text/css',
  doc: 'application/msword',
  docx:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  eml: 'message/rfc822',
  eps: 'application/postscript',
  exe: 'application/octet-stream',
  flac: 'audio/flac',
  fli: 'video/fli',
  gif: 'image/gif',
  gz: 'application/gzip',
  h: 'text/plain',
  htm: 'text/html',
  html: 'text/html',
  ico: 'image/x-icon',
  ics: 'text/calendar',
  java: 'text/plain',
  jfif: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'application/javascript',
  json: 'application/json',
  jsp: 'text/html',
  log: 'text/plain',
  m3u8: 'application/x-mpegurl',
  m4a: 'audio/x-m4a',
  m4v: 'video/mp4',
  md: 'text/plain',
  mth: 'multipart/related',
  mhtml: 'multipart/related',
  midi: 'audio/midi',
  mov: 'video/quicktime',
  mp2: 'audio/mpeg',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  ogm: 'video/ogg',
  ogv: 'video/ovg',
  opus: 'audio/ogg',
  pdf: 'application/pdf',
  php: 'text/html',
  pjp: 'image/jpeg',
  pjpeg: 'image/jpeg',
  pl: 'text/html',
  png: 'image/x-png',
  pps: 'application/vnd.ms-powerpoint',
  ppt: 'application/vnd.ms-powerpoint',
  pptx:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ps: 'application/postscript',
  rar: 'application/octet-stream',
  rdf: 'application/rdf+xml',
  rss: 'application/rss+xml',
  sh: 'text/x-sh',
  shtm: 'text/html',
  shtml: 'text/html',
  svg: 'image/svg+xml',
  svgz: 'image/svg+xml',
  swf: 'application/x-shockwave-flash',
  swl: 'application/x-shockwave-flash',
  tar: 'application/x-tar',
  text: 'text/plain',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  tgz: 'application/gzip',
  txt: 'text/plain',
  wav: 'audio/wav',
  webm: 'audio/webm',
  webp: 'image/webp',
  woff: 'application/font-woff',
  xbl: 'text/xml',
  xht: 'application/xhtml+xml',
  xhtm: 'application/xhtml+xml',
  xhtml: 'application/xhtml+xml',
  xmb: 'image/x-xbitmap',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'text/xml',
  xsl: 'text/xml',
  xslt: 'text/xml',
  xul: 'application/vnd.mozilla.xul+xml',
  zip: 'application/zip'
};
