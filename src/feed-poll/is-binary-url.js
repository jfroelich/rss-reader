import assert from "/src/common/assert.js";
import * as MimeUtils from "/src/common/mime-utils.js";

// Return true if url probably represents a binary resource. This is shallow in the sense that it
// does not actually investigate the bytes of the resource, nor does it fetch the resource. This
// sniffer looks purely at the url itself.
export default function isBinaryURL(url) {
  assert(url instanceof URL);

  // Handle a few obvious cases
  const textProtocols = ['tel:', 'mailto:', 'javascript:'];
  if(textProtocols.includes(url.protocol)) {
    return false;
  }

  // Special handling for data uris
  if(url.protocol === 'data:') {
    // text/plain is the default according to MDN
    const mimeType = findMimeTypeInDataURL(url) || 'text/plain';
    return isBinaryMimeType(mimeType);
  }

  const extension = getExtensionFromURL(url);
  if(!extension) {
    return false;
  }

  const mimeType = findMimeTypeForExtension(extension);
  if(!mimeType) {
    return false;
  }

  return isBinaryMimeType(mimeType);
}


// Return a mime type corresponding a file name extension
// @param extension {String}
// @returns {String} a mime type, or undefined on error or failed lookup
function findMimeTypeForExtension(extension) {
  const extensionVarType = typeof extension;
  if(extensionVarType === 'undefined' || extension === null) {
    return;
  }

  assert(extensionVarType === 'string');
  return EXTENSION_TYPE_MAP[extension];
}


// Extracts the mime type of a data uri as string. Returns undefined if not found or invalid.
function findMimeTypeInDataURL(url) {
  assert(url.protocol === 'data:');

  const href = url.href;

  // If the url is too short to contain a mime type, fail.
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
    //console.debug('Extracted mime type from data uri: ', mimeType);
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


function isBinaryMimeType(mimeType) {
  assert(MimeUtils.isMimeType(mimeType));

  // Mime types that have the application super type but are not binary
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

  const slashPosition = mimeType.indexOf('/');
  const superType = mimeType.substring(0, slashPosition);

  switch(superType) {
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
    console.debug('unhandled mime type:', mimeType);
    return false;
  }
}


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
  mhtml:'multipart/related',
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
  pjpeg:'image/jpeg',
  pl:   'text/html',
  png:  'image/x-png',
  pps:  'application/vnd.ms-powerpoint',
  ppt:  'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ps:   'application/postscript',
  rar:  'application/octet-stream',
  rdf:  'application/rdf+xml',
  rss:  'application/rss+xml',
  sh:   'text/x-sh',
  shtm: 'text/html',
  shtml:'text/html',
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
  xhtml:'application/xhtml+xml',
  xmb:  'image/x-xbitmap',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml:  'text/xml',
  xsl:  'text/xml',
  xslt: 'text/xml',
  xul:  'application/vnd.mozilla.xul+xml',
  zip:  'application/zip'
};
