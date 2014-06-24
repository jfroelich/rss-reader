/**
 * Language-related functions, functions for working with primitives
 */




/**
 * Copies properties from src (specific to src) to
 * target.
 */
function extend(target,src) {
  for(var key in src) {
    if(src.hasOwnProperty(key)) {
      target[key] = src[key];
    }
  }
  return target;
}

function setIfNotEmpty(obj, key, value) {
  if(value) {
    obj[key] = value;
  }
}



/**
 * Refactor to allow thisArg
 */
function each(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len;
    func(obj[i++])) {
  }
}

function reverseEach(obj, func) {
  var i = obj.length;
  while(i--) {
    func(obj[i]);
  }
}

function filter(obj, func) {
  return Array.prototype.filter.call(obj, func);
}

// Deprecate in favor of inverted [].some?
function until (obj, func) {
  for(var i = 0, len = obj ? obj.length : 0, continues = 1;
    continues && i < len; continues = func(obj[i++])) {
  }
}

function until2(obj, func) {
  return Array.prototype.some.call(obj, function(val) {
    return !func(val);
  });
}

// Deprecate in favor of [].some
function any(obj, func) {
  return Array.prototype.some.call(obj, func);
}

// TODO: finish args
function toArray(obj) {
  return Array.prototype.slice.call(obj);
}


function values(obj) {
  var arr = [];
  Object.getOwnPropertyNames(obj).forEach(function(key) {
    arr.push(obj[key]);
  });
  return arr;
}

// Finds the highest number in an array of unsigned longs
// Adapted from http://stackoverflow.com/questions/11190407
function arrayMax(arr) {
  if(arr && arr.length) {
    return arr.reduce(function(max, currentValue) {
      return Math.max(max, currentValue);
    }, -Infinity);
  }
}

// Extremely simple date formatting
function formatDate(date, sep) {
  return date?
    [date.getMonth() + 1, date.getDate(), date.getFullYear()].join(sep || '-') :
    '';
}

// Extremely simple date parsing.
function parseDate(str) {
  if(!str) {
    return;
  }

  var date = new Date(str);

  if(Object.prototype.toString.call(date) != '[object Date]') {
    return;
  }

  if(!isFinite(date)) {
    return;
  }

  return date;
}

function stripControls(str) {
  if(str) return str.replace(/[\t\r\n]/g,'');
}

// Returns true if str1 starts with str2
function startsWith(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
}

// Truncates a string
function truncate(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
}

/**
 * Strip HTML tags from a string
 * Replacement is an optional parameter, string, that is included
 * in the place of tags. Specifying a replacement works
 * considerably slower and may differ in behavior.
 */
function stripTags(str, replacement) {
  if(str) {
    var doc = parseHTML(str);
    if(replacement) {
      var it = doc.createNodeIterator(doc, NodeFilter.SHOW_TEXT),
        node, textNodes = [];
      while(node = it.nextNode()) {
        textNodes.push(node.data);
      }

      return textNodes.join(replacement);
    }

    return doc.textContent;
  }
}




/**
 * Quick and dirty string replacement of <br>
 */
function stripBRs(str) {
  if(str) {
    return str.replace(/<br>/gi,'');
  }
}

function parseHTML(str) {
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;
  return doc.body;
}

function parseXML(str) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(str, 'application/xml');

  var errorElement = $('parsererror',doc);
  if(errorElement) {
    if(errorElement.firstChild && errorElement.firstChild.nextSibling) {
      throw errorElement.firstChild.nextSibling.textContent;
    }
    throw errorElement.textContent;
  }

  return doc;
}


