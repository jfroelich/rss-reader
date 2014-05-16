'use strict';

// Utilities lib
(function(g) {

// forEach for array-like objects and arrays
g.each = function(o, f) {
  for(var i = 0, ln = o?o.length:0; i < ln; f(o[i++])) {}
};

// Iterate over o until f does not yield a truthful value
g.until = function(o, f) {
  for(var i = 0, ln = o ? o.length : 0, c = 1; c && i < ln; c = f(o[i++])) {}
};

// Returns truthy if f returns true for any item in o
// Iterates in reverse, stops once f returns true.
g.any = function(o, f) {
  for(var i = o ? o.length : 0; i--;) {
    if(f(o[i]))
      return 1;
  }
};

/*var i = o ? 0 : o.length;
while(i--) {
  if(f(o[i])) {
     return true;
  }
}*/

var getEntityCode = function(c) {
  return '&#' + c.charCodeAt(0) + ';';
};

// & not being escaped at the moment, intentionally
g.escapeHTML = function(str) {
  if(str)
    return str.replace(/[<>"”'`]/g, getEntityCode);
};


g.escapeHTMLAttribute = function(str) {
  if(str)
    return str.replace('&','&#38;').replace('"','&#34;').
      replace('\'','&#39;').replace('\\','&#92;');
};

g.escapeHTMLInputValue = function(str) {
  if(str)
    return str.replace('"', '&#34;');
};

g.escapeHTMLHREF = function(str) {
  if(str)
    return str.replace('"', '&#34;');
};

g.isArray = function(obj) {
  return obj instanceof Array;
};

g.startsWith = function(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
};

// Generates a detached DOM object
g.parseHTML = function(htmlString) {
  //var doc = (new DOMParser()).parseFromString(htmlString,'text/html');
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = htmlString;
  return doc;
};

// Replace a node with its children.
g.unwrap = function(node) {
  while(node.firstChild)
    node.parentNode.insertBefore(node.firstChild, node);
  node.parentNode.removeChild(node);
};

// Possibly better way of unwrapping live nodes
// NOT EXPORTED, UNTESTED
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
g.truncate = function(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
};

// Very simple date formatting
g.formatDate = function(date, sep) {
  if(date) {
    return [date.getMonth() + 1, date.getDate(), date.getFullYear()
      ].join(sep || '-');
  } else {
    return '';
  }
};

// Very simple date parsing
g.parseDate = function(str) {
  if(str) {
    var date = new Date(str);
    if(Object.prototype.toString.call(date) == '[object Date]' &&
      isFinite(date)) {
      return date;
    }
  }
};

// Returns a URL to the favicon for the given URL
g.getFavIcon = function(url) {
  return url ? 'http://www.google.com/s2/favicons?domain_url=' +
      encodeURIComponent(url) : 'img/rss_icon_trans.gif'
};

}(this));