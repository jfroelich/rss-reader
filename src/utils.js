// See license.md

'use strict';

const utils = {};

// Triggers a file download
utils.download = function(blobObject, fileNameString) {
  const objectURL = URL.createObjectURL(blobObject);
  const anchorElement = document.createElement('a');
  anchorElement.setAttribute('download', fileNameString);
  anchorElement.href = objectURL;
  anchorElement.click();
  URL.revokeObjectURL(objectURL);
};

// Truncates a string containing some html, taking special care not to
// truncate in the midst of a tag or an html entity. The transformation is
// lossy as some entities are not re-encoded (e.g. &#32;).
// The input string should be encoded, meaning that it should contain
// character entity codes. The extension string should be decoded, meaning
// that it should not contain character entries.
// NOTE: Using var due to deopt warning "unsupported phi use of const", c55
utils.truncateHTML = function(inputString, position, extensionString) {

  if(!Number.isInteger(position) || position < 0) {
    throw new TypeError();
  }

  var ellipsis = '\u2026';
  var extension = extensionString || ellipsis;
  var documentObject = document.implementation.createHTMLDocument();
  documentObject.documentElement.innerHTML = inputString;
  var nodeIterator = documentObject.createNodeIterator(
    documentObject.body, NodeFilter.SHOW_TEXT);
  var acceptingText = true;
  var totalLength = 0;

  for(var node = nodeIterator.nextNode(); node;
    node = nodeIterator.nextNode()) {
    if(!acceptingText) {
      node.remove();
      continue;
    }

    // Accessing nodeValue yields a decoded string
    var value = node.nodeValue;
    var valueLength = value.length;
    if(totalLength + valueLength >= position) {
      acceptingText = false;
      var remaining = position - totalLength;
      // Setting nodeValue will implicitly encode the string
      node.nodeValue = value.substr(0, remaining) + extension;
    } else {
      totalLength = totalLength + valueLength;
    }
  }

  // If the document was an html fragment then exclude the tags implicitly
  // inserted when setting innerHTML
  let outputString;
  if(/<html/i.test(inputString)) {
    outputString = documentObject.documentElement.outerHTML;
  } else {
    outputString = documentObject.body.innerHTML;
  }

  return outputString;
};

utils.getAlarm = function(alarmNameString) {
  return new Promise(function(resolve, reject) {
    chrome.alarms.get(alarmNameString, resolve);
  });
};

utils.isURLObject = function(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
};

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Impure.
utils.filterEmptyProperties = function(object) {
  const outputObject = {};
  const hasOwnProperty = Object.prototype.hasOwnProperty;

  for(let prop in object) {
    if(hasOwnProperty.call(object, prop)) {
      const value = object[prop];
      if(value !== undefined && value !== null && value !== '') {
        outputObject[prop] = value;
      }
    }
  }

  return outputObject;
};

// Creates a new object containing only those properties where predicate returns
// true. Predicate is called with parameters object and prop name
utils.filterObjectProperties = function(inputObject, predicateFunction) {
  const outputObject = {};
  for(let propertyName in inputObject) {
    if(predicateFunction(inputObject, propertyName)) {
      outputObject[propertyName] = inputObject[propertyName];
    }
  }
  return outputObject;
};

utils.condenseWhitespace = function(string) {
  return string.replace(/\s{2,}/g, ' ');
};

// Returns a new string where Unicode Cc-class characters have been removed
// Adapted from http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
utils.filterControlCharacters = function(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
};

utils.formatDate = function(dateObject, delimiterString) {
  const partArray = [];
  if(dateObject) {
    // getMonth is a zero based index
    partArray.push(dateObject.getMonth() + 1);
    partArray.push(dateObject.getDate());
    partArray.push(dateObject.getFullYear());
  }
  return partArray.join(delimiterString || '/');
};

// TODO: this could use some cleanup or at least some clarifying comments
utils.fadeElement = function(element, durationSeconds, delaySeconds) {
  return new Promise(function(resolve, reject) {
    const style = element.style;
    if(style.display === 'none') {
      style.display = '';
      style.opacity = '0';
    }

    if(!style.opacity) {
      style.opacity = style.display === 'none' ? '0' : '1';
    }

    element.addEventListener('webkitTransitionEnd', resolve, {'once': true});

    // property duration function delay
    style.transition = `opacity ${durationSeconds}s ease ${delaySeconds}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  });
};

// A mapping between common file extensions and mime types
utils.extensionMimeMap = {
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

// Guess if the url path is not an html mime type
utils.sniffNonHTMLPath = function(pathString) {
  const typeString = utils.sniffTypeFromPath(pathString);
  if(typeString) {
    const slashPosition = type.indexOf('/');
    const superTypeString = typeString.substring(0, slashPosition);
    const nonHTMLSuperTypes = ['application', 'audio', 'image', 'video'];
    return nonHTMLSuperTypes.includes(superTypeString);
  }
};

// Guess the mime type of the url path by looking at the filename extension
utils.sniffTypeFromPath = function(pathString) {
  const extensionString = utils.findPathExtension(pathString);
  if(extensionString) {
    return utils.extensionMimeMap[extensionString];
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
utils.findPathExtension = function(pathString) {

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


// TODO: probably should just deprecate these functions

utils.hideElement = function(element) {
  element.style.display = 'none';
};

utils.showElement = function(element) {
  element.style.display = 'block';
};

utils.addElementClass = function(element, className) {
  element.classList.add(className);
};

utils.removeElementClass = function(element, className) {
  element.classList.remove(className);
};

utils.isElementVisible = function(element) {
  return element.style.display !== 'none';
};
