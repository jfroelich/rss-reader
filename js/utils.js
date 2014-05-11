// Utilities lib

// forEach for array-like objects and arrays
function each(obj, func) {
  for(var i = 0, ln = obj.length; i < ln; func(obj[i++])) {}
}

// Iterate over o until f does not yield a truthful value
function until(o, f) {
  for(var i = 0, ln = o.length, c = true; c && i < ln; c = f(o[i++]));
}

// Returns true if f returns true for any item in o
// Iterates in reverse, stops once f returns true.
function any(o, f) {
  var i = o ? 0 : o.length;
  while(i--) {
    if(f(o[i])) {
       return true;
    }
  }
}

function escapeHTML(str) {
  if(str) {
    // return str.replace(/[&<>"”'`]/g, getEntityCodeHTML);
    return str.replace(/[<>"”'`]/g, getEntityCodeHTML);
  }
}

function getEntityCodeHTML(c) {
  return '&#' + c.charCodeAt(0) + ';';
}

function escapeHTMLAttribute(str) {
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

function escapeHTMLHREF(str) {
  if(str) {
    return str.replace('"', '&#34;');
  }
}

function isArray(obj) {
  return obj instanceof Array;
}

function startsWith(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) === 0;
}


// Generates a new DOM object from a string. The object is detached. 
// Detaching avoids aggressive resource fetching (in Chrome)
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
function truncate(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
}

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
      return date;
    }
  }
}

// Converts a decimal to hexadecimal (uppercase)
function decToHex(d) {
  if(typeof d != 'undefined') {
    return ((d < 0) ? 0xFFFFFFFF + d + 1 : d).toString(16).toUpperCase();
  }
}

// Returns a URL to the favicon for the given URL
function getFavIcon(url) {
  return url ? 'http://www.google.com/s2/favicons?domain_url=' +
      encodeURIComponent(url) : 'img/rss_icon_trans.gif'
}
