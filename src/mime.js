// See license.md

'use strict';

class Mime {

  // Guess if the url path is not an html mime type
  static sniffNonHTML(path) {
    const nonHTMLSuperTypes = ['application', 'audio', 'image', 'video'];
    const type = Mime.sniffPath(path);
    if(type) {
      const superType = type.substring(0, type.indexOf('/'));
      return nonHTMLSuperTypes.includes(superType);
    }
  }

  // Guess the mime type of the url path by looking at the filename extension
  static sniffPath(path) {
    const ext = Mime.getExtension(path);
    if(ext)
      return Mime.mapping[ext];
  }

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
  static getExtension(path) {
    const maxExtLen = 6;
    const minPathLen = '/a.b'.length;
    if(!path || path.length < minPathLen)
      return;
    const lastDotPos = path.lastIndexOf('.');
    if(lastDotPos !== -1) {
      const ext = path.substring(lastDotPos + 1);
      const len = ext.length;
      if(len > 0 && len < maxExtLen && /[a-z]/i.test(ext))
        return ext.toLowerCase();
    }
  }
}

// A mapping between common file extensions and mime types
Mime.mapping = {
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
