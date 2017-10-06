// Return true if the path probably represents a binary resource
// TODO: test input 'foo.'
// TODO: write tests
function is_probably_binary_path(path) {
  'use strict';

  // 1. Validate the input path
  // 2. Grab the extension from the path and validate it.
  // 3. Guess mime type for the extension.
  // 4. Get the super type of the mime type.
  // 5. Return true if the super type is one of the binary super types.

  ASSERT(typeof path === 'string');

  // Any string that does not start with a leading slash is not a path. This is
  // an invariant condition of the path type. The caller should never call this
  // function on a string that is not a path.
  ASSERT(path.charAt(0) === '/');

  // Any string that contains a space cannot be a path. This is an invariant
  // condition of the path type. The caller should never call this function
  // on a string that is not a path.
  ASSERT(!path.includes(' '));


  const min_path_length = '/a.b'.length;
  if(path.length < min_path_length)
    return false;

  const last_dot_position = path.lastIndexOf('.');
  if(last_dot_position === -1)
    return false;

  // A path that ends with a period is a valid path.

  // The +1 skips past the period itself.
  // TODO: this should avoid out of bounds error? What if dot is final position?
  let extension = path.substring(last_dot_position + 1);

  // If the path ended with a dot, then the extension string will be
  // empty, so assume the path is malformed and no extension exists
  // TODO: does this make sense if I avoid the case above?
  if(!extension)
    return false;

  const max_extension_len = 4;
  if(extension.length > max_extension_len)
    return false;

  extension = extension.toLowerCase();
  if(!/[a-z]/.test(extension))
    return false;


/*
TODO: update the map content to reflect some of Google's own classifications
as shown by the following url
https://chromium.googlesource.com/chromium/src/+/net/base/mime_util.cc

Turns out that idea of sniffing via extension is very common. In
fact the comments in that source say it reflects how mozilla does it.


{"video/webm", "webm"},
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
{"image/tiff", "tiff,tif"},
{"image/vnd.microsoft.icon", "ico"},
{"image/x-png", "png"},
{"image/x-xbitmap", "xbm"},
{"message/rfc822", "eml"},
{"text/calendar", "ics"},
{"text/html", "ehtml"},
{"text/plain", "txt,text"},
{"text/x-sh", "sh"},
{"text/xml", "xsl,xbl,xslt"},
{"video/mpeg", "mpeg,mpg"},



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
      'application/vnd.openxmlformats-officedocument.presentationml.' +
      'presentation',
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

  const mime_type = extension_mime_map[extension];
  if(!mime_type)
    return false;

  const slash_position = mime_type.indexOf('/');

  // Second guess whether the mappings table contains valid mime types
  if(slash_position === -1)
    return false;

  const super_type = mime_type.substring(0, slash_position);
  const bin_super_types = ['application', 'audio', 'image', 'video'];
  return bin_super_types.includes(super_type);
}
