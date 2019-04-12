import assert from '/lib/assert.js';
import getPathExtension from '/lib/get-path-extension.js';
import * as mime from '/lib/mime-utils.js';

export const UNKNOWN_CLASS = 0;
export const TEXT_CLASS = 1;
export const BINARY_CLASS = 2;

// Classifies a resource as binary, text, or unknown. Returns unknown when not
// confident in the results. Guesses the class of the resource purely by looking
// at its url.
export function classify(url) {
  assert(url instanceof URL);

  if (url.href === 'about:blank') {
    return TEXT_CLASS;
  }

  const textProtocols = ['tel:', 'mailto:', 'javascript:'];
  if (textProtocols.includes(url.protocol)) {
    return TEXT_CLASS;
  }

  if (url.protocol === 'data:') {
    const mimeType = dataURIFindMimeType(url);
    return mimeType ? mimeTypeIsBinary(mimeType) : UNKNOWN_CLASS;
  }

  const extension = getPathExtension(url.pathname);
  if (extension) {
    const mimeType = EXTENSION_TYPE_MAP[extension];
    if (mimeType) {
      return mimeTypeIsBinary(mimeType);
    }
  }

  return UNKNOWN_CLASS;
}

export function dataURIFindMimeType(url) {
  assert(url instanceof URL);
  assert(url.protocol === 'data:');

  // TODO: cite spec
  const defaultMimeType = 'text/plain';

  const { href } = url;
  if (href.length < mime.MIN_LENGTH) {
    return defaultMimeType;
  }

  const uriPrefixLength = 'data:'.length;
  const searchStartIndex = uriPrefixLength;
  const searchEndIndex = uriPrefixLength + mime.MAX_LENGTH + 1;
  const haystack = href.substring(searchStartIndex, searchEndIndex);

  const semicolonPosition = haystack.indexOf(';');
  if (semicolonPosition < 0) {
    return defaultMimeType;
  }

  if (semicolonPosition < mime.MIN_LENGTH) {
    return defaultMimeType;
  }

  const mimeType = haystack.substring(0, semicolonPosition);
  return mime.isValid(mimeType) ? mimeType : defaultMimeType;
}

export function mimeTypeIsBinary(mimeType) {
  assert(mime.isValid(mimeType));

  const applicationTextMimeTypes = [
    'application/atom+xml', 'application/javascript', 'application/json',
    'application/rdf+xml', 'application/rss+xml',
    'application/vnd.mozilla.xul+xml', 'application/xhtml+xml',
    'application/xml',
  ];

  const forwardSlashPosition = mimeType.indexOf('/');
  const superMimeType = mimeType.substring(0, forwardSlashPosition);

  switch (superMimeType) {
    case 'application':
      return applicationTextMimeTypes.includes(mimeType) ? TEXT_CLASS
        : BINARY_CLASS;
    case 'text':
      return TEXT_CLASS;
    case 'audio':
      return BINARY_CLASS;
    case 'image':
      return BINARY_CLASS;
    case 'video':
      return BINARY_CLASS;
    case 'multipart':
      return BINARY_CLASS;
    default:
      return UNKNOWN_CLASS;
  }
}

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
  class: 'application/java',
  com: 'application/octet-stream',
  cpp: 'text/plain',
  css: 'text/css',
  doc: 'application/msword',
  docx: 'application/msword',
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
  pptx: 'application/vnd.ms-powerpoint',
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
  zip: 'application/zip',
};
