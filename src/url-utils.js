// See license.md

'use strict';

// A mapping between common file extensions and mime types
const file_ext_to_mime_type_map = {
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
  'cpp':  'text/plain',
  'css':  'text/css',
  'doc':  'application/msword',
  'docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'exe':  'application/octet-stream',
  'flac': 'audio/flac',
  'fli':  'video/fli',
  'gif':  'image/gif',
  'gz':   'application/x-gzip',
  'h':    'text/plain',
  'htm':  'text/html',
  'html': 'text/html',
  'ico':  'image/x-icon',
  'java': 'text/plain',
  'jpg':  'image/jpg',
  'js':   'application/javascript',
  'json': 'application/json',
  'jsp':  'text/html',
  'log':  'text/plain',
  'md':   'text/plain',
  'midi': 'audio/midi',
  'mov':  'video/quicktime',
  'mp2':  'audio/mpeg', // can also be video
  'mp3':  'audio/mpeg3', // can also be video
  'mpg':  'audio/mpeg', // can also be video
  'ogg':  'audio/ogg',
  'ogv':  'video/ovg',
  'pdf':  'application/pdf',
  'php':  'text/html',
  'pl':   'text/html',
  'png':  'image/png',
  'pps':  'application/vnd.ms-powerpoint',
  'ppt':  'application/vnd.ms-powerpoint',
  'pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'rar':  'application/octet-stream',
  'rss':  'application/rss+xml',
  'svg':  'image/svg+xml',
  'swf':  'application/x-shockwave-flash',
  'tiff': 'image/tiff',
  'wav':  'audio/wav',
  'xls':  'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'xml':  'application/xml',
  'zip':  'application/zip'
};

// Given a url, try and guess the mime type of the url by looking at the
// filename extension
function guess_mime_type_from_url(url_obj) {
  const ext = get_url_extension(url_obj);
  if(ext)
    return file_ext_to_mime_type_map[ext];
}

// @param url {URL}
// @returns {String} lowercase extension
function get_url_extension(url) {
  const path = url.pathname;

  // must have at least '/a.b'
  if(path.length < 4)
    return;

  const last_dot = path.lastIndexOf('.');
  if(last_dot === -1)
    return;

  // TODO: what about 'foo.', will this throw?
  const ext = path.substring(last_dot + 1);
  const len = ext.length;
  if(len > 0 && len < 5 && /[a-z]/i.test(ext))
    return ext.toLowerCase();
}

// @param url_str {String}
// @param base_url {URL}
function resolve_url(url_str, base_url) {
  if(typeof url_str !== 'string')
    throw new TypeError();
  if(!is_url_object(base_url))
    throw new TypeError();
  if(url_has_js_protocol(url_str) ||
    url_has_data_protocol(url_str))
    return null;
  try {
    return new URL(url_str, base_url);
  } catch(error) {
    console.warn(error);
  }

  return null;
}

function url_has_data_protocol(url_str) {
  return /^\s*data:/i.test(url_str);
}

function url_has_js_protocol(url_str) {
  return /^\s*javascript:/i.test(url_str);
}

// TODO: ObjectUtils?
function is_url_object(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}
