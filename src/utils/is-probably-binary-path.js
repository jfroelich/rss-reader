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

  if(typeof path !== 'string')
    throw new TypeError('path is not a defined string: ' + path);

  if(path.charAt(0) !== '/')
    throw new TypeError('path missing leading slash: ' + path);

  if(path.includes(' '))
    throw new TypeError('path contains space: ' + path);

  const min_path_length = '/a.b'.length;
  if(path.length < min_path_length)
    return false;

  const last_dot_position = path.lastIndexOf('.');
  if(last_dot_position === -1)
    return false;

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

  // Defined inline so as to avoid having the table persist in memory
  // indefinitely. Let v8 worry about optimization. Also avoids global scope
  // pollution
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
