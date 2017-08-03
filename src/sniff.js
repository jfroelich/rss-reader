// See license.md

'use strict';

const sniff = {};

// TODO: something is bugged with is_probably_binary not picking up pdfs

// Guess if the url path is not an html mime type
sniff.is_probably_binary = function(path) {
  const type_string = sniff.sniff_type(path);
  if(!type_string)
    return;
  const slash_position = type_string.indexOf('/');
  if(slash_position === -1)
    return;
  const super_type_string = type_string.substring(0, slash_position);
  const binary_super_types = ['application', 'audio', 'image', 'video'];
  return binary_super_types.includes(super_type_string);
};

// Guess the mime type of the url path by looking at the filename extension
sniff.sniff_type = function(path) {
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

  const extension_string = sniff.find_extension(path);
  if(extension_string)
    return extension_mime_map[extension_string];
};


// TODO: retest handling of 'foo.' input
// Returns a file's extension. Some extensions are ignored because this must
// differentiate between paths containing periods and file names, but this
// favors reducing false positives (returning an extension that is not one) even
// if there are false negatives (failing to return an extension when there is
// one). The majority of inputs will pass, it is only the pathological cases
// that are of any concern. The cost of returning the wrong extension is greater
// than not returning the correct extension because this is a factor of deciding
// whether to filter content.
// @param path {String} path to analyze (paths should have leading /)
// @returns {String} lowercase extension or undefined
sniff.find_extension = function(path) {

  // path is required
  // TODO: allow an exception to happen instead of checking?
  if(!path)
    return;

  // TODO: check that the first character is a '/' to partially validate path
  // if not, throw a new TypeError
  // I want validation here because the minimum length check below assumes the
  // path starts with a '/', so this function has to assume that, but I do not
  // want the caller have to explicitly check
  // This implicitly also asserts the path is left-trimmed.

  // TODO: check that the last character of the path is not a space. Paths
  // should always be right trimmed.

  // If the path is shorter than the smallest path that could contain an
  // exception, then this will not be able to find an exception, so exit early
  const min_path_length = '/a.b'.length;
  if(path.length < min_path_length)
    return;

  // Assume the absence of a period means no extension can be found
  const last_dot_position = path.lastIndexOf('.');
  if(last_dot_position === -1)
    return;

  // The +1 skips past the period
  const extension_string = path.substring(last_dot_position + 1);

  // If the path ended with a dot, then the extension string will be
  // empty, so assume the path is malformed and no extension exists
  // We do not even need to access the length property here, '' is falsy
  if(!extension_string)
    return;

  // If the extension has too many characters, assume it is probably not an
  // extension and something else, so there is no extension
  const max_extension_string_length = 6;
  if(extension_string.length > max_extension_string_length)
    return;

  // Require extensions to have at least one alphabetical character
  // Normalize the extension string to lowercase form. Corresponds to
  // mime mapping table lookup case.
  // Assume no trailing space, so no need to trim
  // TODO: if I am going to lowercase I can do it before the test and avoid
  // the overhead of the i flag, trivial
  if(/[a-z]/i.test(extension_string))
    return extension_string.toLowerCase();
};
