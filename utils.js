// Utilities lib

// Calls a function for each item in an array-like object
function each(obj, func) {
  for(var i = 0, ln = obj.length; i < ln; func(obj[i++])) {}
}

// Calls a function for each item in an array-like object
function legacyEach(obj, func, context) {
  for(var i = 0, len = obj.length; i < len; i++)
    func.call(context, obj[i], i, obj);
}

// Iterate over o until f does not yield a truthful value
function until(o, f) {
  for(var i = 0, ln = o.length, c = true; c && i < ln; c = f(o[i++]));
}

// Returns true if f returns true for any item in o
function any(o, f) {
  var i = o ? 0 : o.length;
  while(i--) {
    if(f(o[i])) {
       return true;
    }
  }
}

// Alias for Object.prototype.hasOwnProperty
function has(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

// Alias for Array.prototype.filter
function filter(obj, func) {
  return Array.prototype.filter.call(obj, func);
}

// Alias for Array.prototype.map
function map(obj, func) {
  return Array.prototype.map.call(obj, func);
}

function getEntityCodeHTML(c) {
  return '&#' + c.charCodeAt(0) + ';';
}

// Encodes some characters
function escapeHTML(str) {
  if(str) {
    return str.replace(/[&<>"”'`]/g, getEntityCodeHTML);
  }
}



// Escape a few characters for writing HTML attribute values
function prepareHTMLAttributeValueForRender(str) {
  if(str) {
    return str.replace('&','&#38;').replace('"','&#34;').
      replace('\'','&#39;').replace('\\','&#92;');
  }
}

function escapeHTMLInputValue(str) {
  if(str) {
    return str.replace('"', '&#34;');
  }
}

function isArray(obj) {
  return obj instanceof Array;
}

// Generates a detached DOM from a string. Detaching avoids
// aggressive resource fetching in Chrome
function parseHTML(htmlString) {
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = htmlString;
  return doc;
}

// Replace a DOM node with its children.
function unwrap(node) {
  while(node.firstChild)
    node.parentNode.insertBefore(node.firstChild, node);
  node.parentNode.removeChild(node);
}

// Possibly better way of unwrapping live nodes (untested)
function unwrapAttached(node) {
  var doc = node.ownerDocument;
  var fragment = doc.createDocumentFragment();
  each(node.childNodes, function(child) {
    fragment.appendChild(child);
  });
  node.parentNode.replaceChild(fragment, node);
}

// Truncates a string
// ext is optional override of default ellipsis replacement
// Note: try '\u2026' instead of '...'
function truncate(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// Very simple date formatting

function formatDate(date, sep) {
  if(date) {
    return [date.getMonth() + 1, date.getDate(), date.getFullYear()
      ].join(sep || '-');
  } else {
    return '';
  }
}

// Very simple date parsing
function parseDate(str) {
  if(str) {
    var date = new Date(str);
    if(Object.prototype.toString.call(date) == '[object Date]' &&
      isFinite(date)) {

      //console.log('Parsed %s as date %s', str, date);

      return date;
    }
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// Simple hash function
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
// See http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method
// See http://docs.closure-library.googlecode.com/git/closure_goog_string_string.js.source.html
// See http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
// See http://jsperf.com/hashing-strings
// 4294967296 == 0x100000000
function hashCode(arr) {
  if(arr && arr.length) {
    return arr.reduce(
      function(a, b) {
        return (a * 31 + b.charCodeAt(0)) % 4294967296;
      },
    0);
  }
}

// Converts a decimal to hexadecimal (uppercase)
function decToHex(d) {
  if(typeof d != 'undefined') {
    return ((d < 0) ? 0xFFFFFFFF + d + 1 : d).toString(16).toUpperCase();
  }
}


//////////////////////////////////////////////////////////////////////////////////////////////////
// Simple URI functions
// Adapted from https://code.google.com/p/js-uri/source/browse/trunk/lib/URI.js

var URI = {};

// Parse a string into a URI
URI.parse = function(str) {
  if(str) {
    var m = str.match(/^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/);
    var r = {};
    if(m[1]) r.scheme = m[1];
    if(m[2]) r.host = m[2];
    if(m[3]) r.path = m[3];
    if(m[4]) r.query = m[4];
    if(m[5]) r.fragment = m[5];
    return r;
  }
};

// Convert URI to string representation
URI.toString = function(obj) {
  if(obj) {
    var s = '';
    if(obj.scheme) s = obj.scheme + ':';
    if(obj.host) s += '//' + obj.host ;
    if(obj.path) s += obj.path;
    if(obj.query) s += '?' + obj.query;
    if(obj.fragment) s += '#' + obj.fragment;
    return s;
  }
};

// Convert a relative URI to an absolute URI string
// TODO: return a URI object, let the caller decide what to do with it
URI.resolve = function(base,path) {
  if(base && path) {
    if(!path.scheme) path.scheme = base.scheme;
    if(!path.host) path.host = base.host;
    return URI.toString(path);
  }
};

//////////////////////////////////////////////////////////////////////////////////////////////////
// FX functions

// Animated scrolling to a target element
// BUG: only works scrolling down
// BUG: when element is 2nd to last element it its parent, it scrolls to page bottom
// BUG: choppy when images are still loading
function smoothScrollTo(element, delta, delay) {
  var timer = setInterval(function(){
    if(document.body.scrollTop + delta >= element.offsetTop) {
      clearInterval(timer);
      window.scrollTo(0, document.body.scrollTop + element.offsetTop - document.body.scrollTop);
    } else if(element.offsetTop + element.offsetHeight >= document.body.scrollHeight - window.innerHeight) {
      // This branch is an attempt to fix a bug where the interval never clears which makes the page
      // permanently try to scroll down even when it cannot
      clearInterval(timer);
      window.scrollTo(0, document.body.scrollHeight);

      // TODO: why is this return statement here???
      return;

    } else if(delta > 0) {
      window.scrollTo(0, document.body.scrollTop + delta);
    }
  }, delay);
}

// Vertically shrink and hide element
function shrink(el, delta, delay, callback) {
  var timer = setInterval(function() {
    if(el.offsetHeight <= delta) {
      clearInterval(timer);
      el.style.display='none';
      if(callback) {
        callback();
      }
    } else {
      el.style.height = el.offsetHeight - delta;
    }
  }, delay);
}

// Fade in/out an element by modifying opacity
function fade(element, delta, delay) {
  var op, timer;

  if(delta >= 0) {
    // fade in
    op = 0.0;
    timer = setInterval(function() {
      if(op >= 1.0) {
        clearInterval(timer);
        op = 1.0;
      }
      element.style.opacity = op;
      op += delta;
    }, delay);
  } else {
    // fade out
    op = 1.0;
    timer = setInterval(function() {
      if(op <= 0.0) {
        clearInterval(timer);
        op = 0.0;
      }
      element.style.opacity = op;
      op += delta;
    }, delay);
  }
}