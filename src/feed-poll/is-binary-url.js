import {isMimeType, MIME_TYPE_MAX_LENGTH, MIME_TYPE_MIN_LENGTH} from '/src/common/mime-utils.js';

// TODO: while this API is straightforward, I feel like at the same type it is
// presented in an unconventional manner. I would prefer this API orient itself
// more similarly to what other sniffing APIs usually look like. Perhaps it
// should be renamed to something like sniff? I think what I would like to do
// is spend some time looking at how other sniffer libraries are implemented
// and consider more closely mimicing their API.

// Returns whether the url represents a binary resource. Note that the return
// value of false means either text or unknown; false does not mean only text.
export default function isBinaryURL(url) {
  if (!(url instanceof URL)) {
    throw new TypeError('Invalid url ' + url);
  }

  if (url.href === 'about:blank') {
    return false;
  }

  // Non-exhaustive
  const textProtocols = ['tel:', 'mailto:', 'javascript:'];
  if (textProtocols.includes(url.protocol)) {
    return false;
  }

  // Special handling for data uris
  if (url.protocol === 'data:') {
    // TODO: if text/plain is the default, that indicates non-binary. Why
    // call isBinaryMimeType? Why not just return false if findMimeTypeInDataURL
    // returns undefined? The logic remains the same but involves one less
    // function call in one of the two paths.

    const defaultDataURIMimeType = 'text/plain';
    const mimeType = findMimeTypeInDataURL(url) || defaultDataURIMimeType;
    return isBinaryMimeType(mimeType);
  }

  // If we cannot make a decision based on protocol, decide based on file
  // extension
  const extension = getExtensionFromURL(url);
  if (!extension) {
    // We cannot confidently say it is binary so report it is not
    // TODO: I do not like how this implies that it is not-binary. This
    // potentially induces a false reliance. Perhaps isBinaryURL should
    // return true, false, and indeterminate, and let the caller decide how
    // to react
    return false;
  }

  const mimeType = findMimeTypeForExtension(extension);
  if (!mimeType) {
    // TODO: again, I do not like how this implies non-binary
    return false;
  }

  return isBinaryMimeType(mimeType);
}

// Return a mime type corresponding a file name extension
// @param extension {String}
// @returns {String} a mime type, or undefined on error or failed lookup
function findMimeTypeForExtension(extension) {
  if (typeof extension === 'string') {
    return EXTENSION_TYPE_MAP[extension];
  }
}

// Extracts the mime type of a data uri. Returns undefined if not
// found or invalid.
function findMimeTypeInDataURL(url) {
  if (!(url instanceof URL)) {
    throw new TypeError('Invalid url ' + url);
  }

  if (url.protocol !== 'data:') {
    throw new TypeError('Invalid data url ' + url.href);
  }

  // Capture the href and cache. The href getter is dynamic and a function,
  // similar to how array.length is a function. I do not trust that that the
  // URL implementation is smart enough to cache property access, at least for
  // now. This admittedly may be premature optimization, but I am overlooking
  // that as I remain ambivalent about its importance. What I am concerned
  // about is whether this is actually slower.
  const href = url.href;

  // If the url is too short to contain a mime type, fail.
  if (href.length < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  // Limit the scope of the string search space to starting after the protocol
  // ends, and up to the longest possible mime type that can be found, plus
  // 1 for the trailing semicolon.
  const PREFIX_LENGTH = 'data:'.length;
  const searchStart = PREFIX_LENGTH;
  const searchEnd = PREFIX_LENGTH + MIME_TYPE_MAX_LENGTH + 1;
  const haystack = href.substring(searchStart, searchEnd);

  // Data uris that include a mime type include a delimiting semicolon after
  // the mime type.
  const semicolonPosition = haystack.indexOf(';');

  // If we cannot find the ';' then conclude the mime type is not present
  if (semicolonPosition < 0) {
    return;
  }

  // If we found a ';' that was located so close to the start that it is
  // impossible for the characters between start and ';' to represent a mime
  // type, then fail.
  if (semicolonPosition < MIME_TYPE_MIN_LENGTH) {
    return;
  }

  // Pluck the candidate characters from the search space. Note this is from the
  // search space, not the full data uri, which begins after the protocol
  const mimeType = haystack.substring(0, semicolonPosition);

  // Finally, validate and return
  if (isMimeType(mimeType)) {
    return mimeType;
  }
}

// Given a url, return the extension of the filename component of the path
// component. Return undefined if no extension found. The returned string
// excludes the leading '.'. This assumes the url uses English characters.
function getExtensionFromURL(url) {
  // Approximate path min length including the period is '/.b'
  const minlen = 3;
  // Approximate extension max length excluding the period
  const maxlen = 255;
  const path = url.pathname;
  const pathlen = path.length;

  if (pathlen >= minlen) {
    const lastDotPos = path.lastIndexOf('.');
    if ((lastDotPos >= 0) && (lastDotPos + 1 < pathlen)) {
      const ext = path.substring(lastDotPos + 1);
      if (ext.length <= maxlen && isAlphanumeric(ext)) {
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
function isAlphanumeric(string) {
  return /^[a-zA-Z0-9]*$/.test(string);
}

// Returns whether the mime type is binary
function isBinaryMimeType(mimeType) {
  if (!isMimeType(mimeType)) {
    throw new TypeError('Invalid mimeType ' + mimeType);
  }

  // This algorithm assumes that mime types with the 'application' supertype are
  // binary unless the subtype is one of the following. The following list
  // is not exhaustive, but it covers most of the cases this app is interested
  // in, which is about fetching xml files.

  // clang-format off
  const appTextTypes = [
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

  const slashPosition = mimeType.indexOf('/');
  const superType = mimeType.substring(0, slashPosition);

  switch (superType) {
    case 'application': {
      return !appTextTypes.includes(mimeType);
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
      // As I am not sure this is an exhaustive list of super types, and I
      // do not really care if it is, reaching the default case does not
      // represent an error
      return false;
  }
}

// A mapping of common file extensions to corresponding mime types. I've tried
// to pick standardized mime types but unfortunately there does not appear to
// be much of a standard.
const EXTENSION_TYPE_MAP = {
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
