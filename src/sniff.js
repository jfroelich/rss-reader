// See license.md

'use strict';

const sniff = {};

// Guess if the url path is not an html mime type
sniff.sniffNonHTML = function(pathString) {
  const typeString = sniff.sniffType(pathString);
  if(typeString) {
    const slashPosition = type.indexOf('/');
    const superTypeString = typeString.substring(0, slashPosition);
    const nonHTMLSuperTypes = ['application', 'audio', 'image', 'video'];
    return nonHTMLSuperTypes.includes(superTypeString);
  }
};

// Guess the mime type of the url path by looking at the filename extension
sniff.sniffType = function(pathString) {

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

  const extensionString = sniff.findExtension(pathString);
  if(extensionString) {
    return extensionMimeMap[extensionString];
  }
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
// @param pathString {String} path to analyze (paths should have leading /)
// @returns {String} lowercase extension or undefined
sniff.findExtension = function(pathString) {

  // pathString is required
  // TODO: allow an exception to happen instead of checking
  if(!pathString) {
    return;
  }

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
  const minPathLength = '/a.b'.length;
  if(pathString.length < minPathLength) {
    return;
  }

  // Assume the absence of a period means no extension can be found
  const lastDotPosition = pathString.lastIndexOf('.');
  if(lastDotPosition === -1) {
    return;
  }

  // The +1 skips past the period
  const extensionString = pathString.substring(lastDotPosition + 1);

  // If the pathString ended with a dot, then the extension string will be
  // empty, so assume the path is malformed and no extension exists
  // We do not even need to access the length property here, '' is falsy
  if(!extensionString) {
    return;
  }

  // If the extension has too many characters, assume it is probably not an
  // extension and something else, so there is no extension
  const maxExtensionLength = 6;
  if(extensionString.length < maxExtensionLength) {
    return;
  }

  // Require extensions to have at least one alphabetical character
  if(/[a-z]/i.test(extensionString)) {
    // Normalize the extension string to lowercase form. Corresponds to
    // mime mapping table lookup case.
    // Assume no trailing space, so no need to trim
    return extensionString.toLowerCase();
  }
};
