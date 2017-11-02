'use strict';

// import base/string.js

// Some commonly used global mime types
const MIME_TYPE_HTML = 'text/html';
const MIME_TYPE_XML = 'application/xml';

// Return a mime type corresponding a file name extension
// @param extension {String}
// @returns {String} a mime type, or undefined on error or failed lookup
function mimeGetTypeForExtension(extension) {
  const extensionVarType = typeof extension;
  if(extensionVarType === 'undefined' || extension === null) {
    return;
  }

  console.assert(extensionVarType === 'string');

  // TODO: move outside of function and rename
  const extensionMimeMap = {
    'ai':   'application/postscript',
    'aif':  'audio/aiff',
    'atom': 'application/atom+xml',
    'avi':  'video/avi',
    'bin':  'application/octet-stream',
    'bmp':  'image/bmp',
    'c':    'text/plain',
    'cc':   'text/plain',
    'cgi':  'text/hml',
    'class':'application/java',
    'com':  'application/octet-stream',
    'cpp':  'text/plain',
    'css':  'text/css',
    'doc':  'application/msword',
    'docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'eml':  'message/rfc822',
    'eps':  'application/postscript',
    'exe':  'application/octet-stream',
    'flac': 'audio/flac',
    'fli':  'video/fli',
    'gif':  'image/gif',
    'gz':   'application/gzip',
    'h':    'text/plain',
    'htm':  'text/html',
    'html': 'text/html',
    'ico':  'image/x-icon', // image/vnd.microsoft.icon
    'ics':  'text/calendar',
    'java': 'text/plain',
    'jfif': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'jpg':  'image/jpeg',
    'js':   'application/javascript',
    'json': 'application/json',
    'jsp':  'text/html',
    'log':  'text/plain',
    'm3u8': 'application/x-mpegurl',
    'm4a':  'audio/x-m4a',
    'm4v':  'video/mp4',
    'md':   'text/plain',
    'mth':  'multipart/related',
    'mhtml': 'multipart/related',
    'midi': 'audio/midi',
    'mov':  'video/quicktime',
    'mp2':  'audio/mpeg',
    'mp3':  'audio/mpeg',
    'mp4':  'video/mp4',
    'mpeg': 'video/mpeg',
    'mpg':  'video/mpeg',
    'oga':  'audio/ogg',
    'ogg':  'audio/ogg',
    'ogm':  'video/ogg',
    'ogv':  'video/ovg',
    'opus': 'audio/ogg',
    'pdf':  'application/pdf',
    'php':  'text/html',
    'pjp':  'image/jpeg',
    'pjpeg': 'image/jpeg',
    'pl':   'text/html',
    'png':  'image/x-png',
    'pps':  'application/vnd.ms-powerpoint',
    'ppt':  'application/vnd.ms-powerpoint',
    'pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.' +
      'presentation',
    'ps':  'application/postscript',
    'rar':  'application/octet-stream',

    // TODO: need to fix url sniffing to uncomment
    // See net/url.js
    // 'rdf': 'application/rdf+xml',
    // 'rss':  'application/rss+xml',

    'sh' :  'text/x-sh',
    'shtm': 'text/html',
    'shtml': 'text/html',
    'svg':  'image/svg+xml',
    'svgz': 'image/svg+xml',
    'swf':  'application/x-shockwave-flash',
    'swl':  'application/x-shockwave-flash',
    'tar':  'application/x-tar',
    'text': 'text/plain',
    'tif':  'image/tiff',
    'tiff': 'image/tiff',
    'tgz':  'application/gzip',
    'txt':  'text/plain',
    'wav':  'audio/wav',
    'webm': 'audio/webm',
    'webp': 'image/webp',
    'woff': 'application/font-woff',
    'xbl':  'text/xml',
    'xht':  'application/xhtml+xml',
    'xhtm': 'application/xhtml+xml',
    'xhtml': 'application/xhtml+xml',
    'xmb':  'image/x-xbitmap',
    'xls':  'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xml':  'text/xml',
    'xsl':  'text/xml',
    'xslt': 'text/xml',
    'xul':  'application/vnd.mozilla.xul+xml',
    'zip':  'application/zip'
  };

  return extensionMimeMap[extension];
}

// Returns a normalized mime type from a content type
// @param contentType {String} an http response header value, optional
// @returns {String} a mime type, or undefined if error
function mimeFromContentType(contentType) {
  const contentTypeVarType = typeof contentType;
  if(contentTypeVarType === 'undefined') {
    return;
  }

  console.assert(contentTypeVarType === 'string');
  let mimeType = contentType;

  // Strip the character encoding, if present. The substring gets all
  // characters up to but excluding the semicolon. The coding
  // is optional, so leave the type as is if no semicolon is present.
  const fromIndex = 0;
  const semicolonPosition = contentType.indexOf(';');
  if(semicolonPosition !== -1) {
    mimeType = contentType.substring(fromIndex, semicolonPosition);
  }

  return mimeNormalize(mimeType);
}

function mimeNormalize(mimeType) {
  return stringRemoveWhitespace(mimeType).toLowerCase();
}

function mimeIsHTML(contentType) {
  return /^\s*text\/html/i.test(contentType);
}

function mimeIsImage(contentType) {
  return /^\s*image\//i.test(contentType);
}

function mimeIsXML(contentType) {
  const mimeType = mimeFromContentType(contentType);
  const types = [
    'application/atom+xml',
    'application/rdf+xml',
    'application/rss+xml',
    'application/xml',
    'text/xml'
  ];
  return types.includes(mimeType);
}
