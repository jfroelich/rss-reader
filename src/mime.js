// MIME utilities module

import assert from "/src/assert.js";
import {filterWhitespace} from "/src/string.js";

// Some commonly used global mime types
export const HTML = 'text/html';
export const XML = 'application/xml';

// These constraints are rather arbitrary, but just as a general bound
// TODO: increase and test accuracy
export const MIME_TYPE_MIN_LENGTH = 7;
export const MIME_TYPE_MAX_LENGTH = 100;

// Return a mime type corresponding a file name extension
// @param extension {String}
// @returns {String} a mime type, or undefined on error or failed lookup
export function getTypeForExtension(extension) {
  const extensionVarType = typeof extension;
  if(extensionVarType === 'undefined' || extension === null) {
    return;
  }

  assert(extensionVarType === 'string');
  return EXTENSION_TYPE_MAP[extension];
}

// Returns a normalized mime type from a content type
// @param contentType {String} an http response header value, optional
// @returns {String} a mime type, or undefined if error
export function fromContentType(contentType) {
  const contentTypeVarType = typeof contentType;
  if(contentTypeVarType === 'undefined') {
    return;
  }

  assert(contentTypeVarType === 'string');
  let mimeType = contentType;

  // Strip the character encoding, if present. The substring gets all
  // characters up to but excluding the semicolon. The coding
  // is optional, so leave the type as is if no semicolon is present.
  const fromIndex = 0;
  const semicolonPosition = contentType.indexOf(';');
  if(semicolonPosition !== -1) {
    mimeType = contentType.substring(fromIndex, semicolonPosition);
  }

  return normalize(mimeType);
}

// A basic trivial test of whether the parameter represents a mime type.
// Inaccurate. Few false negatives but many false positives.
export function isMimeType(mimeType) {
  const MIN_LENGTH = 2, MAX_LENGTH = 100;
  return typeof mimeType === 'string' && mimeType.length > MIN_LENGTH &&
    mimeType.length < MAX_LENGTH && mimeType.includes('/') &&
    !mimeType.includes(' ');
}

export function isBinary(mimeType) {
  assert(isMimeType(mimeType));

  const slashPosition = mimeType.indexOf('/');
  const superType = mimeType.substring(0, slashPosition);

  switch(superType) {
  case 'application': {
    return !APPLICATION_TEXT_TYPES.includes(mimeType);
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
    console.debug('unhandled mime type:', mimeType);
    return false;
  }
}

function normalize(mimeType) {
  assert(isMimeType(mimeType));
  return filterWhitespace(mimeType).toLowerCase();
}

export function isHTML(contentType) {
  return /^\s*text\/html/i.test(contentType);
}

export function isImage(contentType) {
  return /^\s*image\//i.test(contentType);
}

export function isXML(contentType) {
  const mimeType = fromContentType(contentType);
  const types = [
    'application/atom+xml',
    'application/rdf+xml',
    'application/rss+xml',
    'application/vnd.mozilla.xul+xml',
    'application/xml',
    'application/xhtml+xml',
    'text/xml'
  ];
  return types.includes(mimeType);
}

// Mime types that have the application super type but are not binary
const APPLICATION_TEXT_TYPES = [
  'application/atom+xml',
  'application/javascript',
  'application/json',
  'application/rdf+xml',
  'application/rss+xml',
  'application/vnd.mozilla.xul+xml',
  'application/xhtml+xml',
  'application/xml'
];

const EXTENSION_TYPE_MAP = {
  ai:   'application/postscript',
  aif:  'audio/aiff',
  atom: 'application/atom+xml',
  avi:  'video/avi',
  bin:  'application/octet-stream',
  bmp:  'image/bmp',
  c:    'text/plain',
  cc:   'text/plain',
  cgi:  'text/html',
  'class':'application/java',
  com:  'application/octet-stream',
  cpp:  'text/plain',
  css:  'text/css',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  eml:  'message/rfc822',
  eps:  'application/postscript',
  exe:  'application/octet-stream',
  flac: 'audio/flac',
  fli:  'video/fli',
  gif:  'image/gif',
  gz:   'application/gzip',
  h:    'text/plain',
  htm:  'text/html',
  html: 'text/html',
  ico:  'image/x-icon',
  ics:  'text/calendar',
  java: 'text/plain',
  jfif: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpg:  'image/jpeg',
  js:   'application/javascript',
  json: 'application/json',
  jsp:  'text/html',
  log:  'text/plain',
  m3u8: 'application/x-mpegurl',
  m4a:  'audio/x-m4a',
  m4v:  'video/mp4',
  md:   'text/plain',
  mth:  'multipart/related',
  mhtml: 'multipart/related',
  midi: 'audio/midi',
  mov:  'video/quicktime',
  mp2:  'audio/mpeg',
  mp3:  'audio/mpeg',
  mp4:  'video/mp4',
  mpeg: 'video/mpeg',
  mpg:  'video/mpeg',
  oga:  'audio/ogg',
  ogg:  'audio/ogg',
  ogm:  'video/ogg',
  ogv:  'video/ovg',
  opus: 'audio/ogg',
  pdf:  'application/pdf',
  php:  'text/html',
  pjp:  'image/jpeg',
  pjpeg: 'image/jpeg',
  pl:   'text/html',
  png:  'image/x-png',
  pps:  'application/vnd.ms-powerpoint',
  ppt:  'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ps:  'application/postscript',
  rar:  'application/octet-stream',
  rdf: 'application/rdf+xml',
  rss:  'application/rss+xml',
  sh:  'text/x-sh',
  shtm: 'text/html',
  shtml: 'text/html',
  svg:  'image/svg+xml',
  svgz: 'image/svg+xml',
  swf:  'application/x-shockwave-flash',
  swl:  'application/x-shockwave-flash',
  tar:  'application/x-tar',
  text: 'text/plain',
  tif:  'image/tiff',
  tiff: 'image/tiff',
  tgz:  'application/gzip',
  txt:  'text/plain',
  wav:  'audio/wav',
  webm: 'audio/webm',
  webp: 'image/webp',
  woff: 'application/font-woff',
  xbl:  'text/xml',
  xht:  'application/xhtml+xml',
  xhtm: 'application/xhtml+xml',
  xhtml: 'application/xhtml+xml',
  xmb:  'image/x-xbitmap',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml:  'text/xml',
  xsl:  'text/xml',
  xslt: 'text/xml',
  xul:  'application/vnd.mozilla.xul+xml',
  zip:  'application/zip'
};
