// See license.md

'use strict';

const mime = {};

// A mapping between common file extensions and mime types
mime.ext_map = {
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

// Return true if sniffing the path suggests that the url does not refer to
// an html document. This merely looks at the characters in the path, not the
// content of the referenced resource.
mime.sniff_non_html = function(path) {
  const bad_super_types = ['application', 'audio', 'image', 'video'];
  const type = mime.sniff_path(path);
  if(type) {
    const super_type = type.substring(0, type.indexOf('/'));
    return bad_super_types.includes(super_type);
  }
};

// Given a url, try and guess the mime type of the url by looking at the
// filename extension. This does no inspection of content
mime.sniff_path = function(path) {
  const ext = mime.get_extension(path);
  if(!ext) return;
  return mime.ext_map[ext];
};


// TODO: properly handle 'foo.'
// Returns a file's extension. Some extensions are ignored because this must
// differentiate between paths containing periods and file names, but this
// favors reducing false positives (returning an extension that is not one) even
// if there are false negatives (failing to return an extension when there is
// one). The majority of inputs will pass, it is only the pathological cases
// that are of any concern. The cost of returning the wrong extension is greater
// than not returning the correct extension because this is a factor of deciding
// whether to filter content.
// @param path {String} path to analyze (should have leading /)
// @returns {String} lowercase extension or undefined
mime.get_extension = function(path) {
  const max_ext_len = 6;
  const min_path_len = '/a.b'.length;
  if(!path || path.length < min_path_len)
    return;
  const last_dot = path.lastIndexOf('.');
  if(last_dot !== -1) {
    const ext = path.substring(last_dot + 1);
    const len = ext.length;
    if(len > 0 && len < max_ext_len && /[a-z]/i.test(ext))
      return ext.toLowerCase();
  }
};
