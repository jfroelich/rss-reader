// Mime utils

'use strict';

const MIME_TYPE_HTML = 'text/html';
const MIME_TYPE_XML = 'application/xml';

// TODO: integrate part of the sniff stuff here

function mime_get_type_for_extension(extension) {

  /*
  TODO: update the map content to reflect some of Google's own classifications
  as shown by the following url
  https://chromium.googlesource.com/chromium/src/+/net/base/mime_util.cc

  {"application/x-chrome-extension", "crx"},
  {"application/xhtml+xml", "xhtml,xht,xhtm"},
  {"audio/flac", "flac"},
  {"audio/mp3", "mp3"},
  {"audio/ogg", "ogg,oga,opus"},
  {"audio/wav", "wav"},
  {"audio/webm", "webm"},
  {"audio/x-m4a", "m4a"},
  {"image/gif", "gif"},
  {"image/jpeg", "jpeg,jpg"},
  {"image/png", "png"},
  {"image/webp", "webp"},
  {"multipart/related", "mht,mhtml"},
  {"text/css", "css"},
  {"text/html", "html,htm,shtml,shtm"},
  {"text/xml", "xml"},
  {"video/mp4", "mp4,m4v"},
  {"video/ogg", "ogv,ogm"},

  {"image/x-icon", "ico"},
  {"application/epub+zip", "epub"},
  {"application/font-woff", "woff"},
  {"application/gzip", "gz,tgz"},
  {"application/javascript", "js"},
  {"application/octet-stream", "bin,exe,com"},
  {"application/pdf", "pdf"},
  {"application/pkcs7-mime", "p7m,p7c,p7z"},
  {"application/pkcs7-signature", "p7s"},
  {"application/postscript", "ps,eps,ai"},
  {"application/rdf+xml", "rdf"},
  {"application/rss+xml", "rss"},
  {"application/vnd.android.package-archive", "apk"},
  {"application/vnd.mozilla.xul+xml", "xul"},
  {"application/x-gzip", "gz,tgz"},
  {"application/x-mpegurl", "m3u8"},
  {"application/x-shockwave-flash", "swf,swl"},
  {"application/x-tar", "tar"},
  {"application/zip", "zip"},
  {"audio/mpeg", "mp3"},
  {"image/bmp", "bmp"},
  {"image/jpeg", "jfif,pjpeg,pjp"},
  {"image/svg+xml", "svg,svgz"},

  */

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
    'cpp':  'text/plain',
    'css':  'text/css',
    'doc':  'application/msword',
    'docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'eml':  'message/rfc822',
    'exe':  'application/octet-stream',
    'flac': 'audio/flac',
    'fli':  'video/fli',
    'gif':  'image/gif',
    'gz':   'application/x-gzip',
    'h':    'text/plain',
    'htm':  'text/html',
    'html': 'text/html',
    'ico':  'image/vnd.microsoft.icon', // image/x-icon
    'ics':  'text/calendar',
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
    'mpeg': 'video/mpeg',
    'mpg':  'video/mpeg',
    'ogg':  'audio/ogg',
    'ogv':  'video/ovg',
    'pdf':  'application/pdf',
    'php':  'text/html',
    'pl':   'text/html',
    'png':  'image/x-png',
    'pps':  'application/vnd.ms-powerpoint',
    'ppt':  'application/vnd.ms-powerpoint',
    'pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.' +
      'presentation',
    'rar':  'application/octet-stream',
    'rss':  'application/rss+xml',
    'sh' :  'text/x-sh',
    'svg':  'image/svg+xml',
    'swf':  'application/x-shockwave-flash',
    'text': 'text/plain',
    'tif':  'image/tiff',
    'tiff': 'image/tiff',
    'txt':  'text/plain',
    'wav':  'audio/wav',
    'webm': 'video/webm',
    'xbl':  'text/xml',
    'xmb':  'image/x-xbitmap',
    'xls':  'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xml':  'application/xml',
    'xsl':  'text/xml',
    'xslt': 'text/xml',
    'zip':  'application/zip'
  };

  const mime_type = extension_mime_map[extension];

  return mime_type;
}
