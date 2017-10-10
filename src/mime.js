// Mime utils

'use strict';

// Dependencies:
// assert.js
// string.js

// Some global mime types commonly used
const MIME_TYPE_HTML = 'text/html';
const MIME_TYPE_XML = 'application/xml';

// Return a mime type corresponding a file name extension
// @param extension {String}
// @returns {String} a mime type, or undefined on error or failed lookup
function mime_get_type_for_extension(extension) {
  const t_extension = typeof extension;
  if(t_extension === 'undefined')
    return;

  ASSERT(t_extension === 'string');

  // List adapted from
  // https://chromium.googlesource.com/chromium/src/+/net/base/mime_util.cc

  // Defined inline so as to avoid having the table persist in memory
  // indefinitely. Let v8 worry about optimization. Also avoids global scope
  // pollution, and makes the list private.
  const extension_mime_map = {
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

    // TODO: need to fix binary guessing to uncomment
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

  return extension_mime_map[extension];
}

// Returns a normalized mime type from a content type
// @param content_type {String} an http response header value, optional
// @returns {String} a mime type, or undefined if error
function mime_from_content_type(content_type) {
  const t_content_type = typeof content_type;
  if(t_content_type === 'undefined')
    return;
  ASSERT(t_content_type === 'string');
  let mime_type = content_type;

  // Strip the character encoding, if present. The substring gets all
  // characters up to but excluding the semicolon. I understand the coding
  // to be optional, so leave the type as is if no semicolon is present.
  const from_index = 0;
  const semicolon_position = content_type.indexOf(';');
  if(semicolon_position !== -1)
    mime_type = content_type.substring(from_index, semicolon_position);

  // Normalize and return, the trim is implicit
  return string_remove_whitespace(mime_type).toLowerCase();
}
