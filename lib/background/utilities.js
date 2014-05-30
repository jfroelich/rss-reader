// Misc utilty modules

// Considering deprecating it and 
// switching to Underscore.
var collections = {};

// forEach for array-like objects
collections.each = function(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len; 
    func(obj[i++])) {
  }
};

// Iterate over obj until func does not yield a truthful value
collections.until = function(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0, continues = 1; 
    continues && i < len; continues = func(obj[i++])) {
  }
};

// Returns truthy if func returns true for any item in obj
// Iterates in reverse, stops once func returns true.
collections.any = function(obj, func) {
  for(var i = obj ? obj.length : 0; i--;) {
    if(func(obj[i]))
      return 1;
  }
};

collections.values = function(obj) {
  var arr = [];
  Object.getOwnPropertyNames(obj).forEach(function(key) {
    arr.push(obj[key]);
  });
  return arr;
};

// Adapted from http://stackoverflow.com/questions/11190407
// TODO: consider using the apply method

// Finds the highest number in an array of unsigned longs
collections.arrayMax = function(arr) {
  if(arr && arr.length) {
    return arr.reduce(collections.wrapMax_, -Infinity);
  }
};

collections.wrapMax_ = function(previousValue, currentValue) {
  return Math.max(previousValue, currentValue); 
};


var dates = {};

// Extremely simple date formatting
dates.formatDate = function(date, sep) {
  
  if(date) {
    return [date.getMonth() + 1, date.getDate(), date.getFullYear()
      ].join(sep || '-');
  }
  
  return '';
};

// Extremely simple (and naive) date parsing.
dates.parseDate = function(str) {
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
};

var strings = {};


strings.stripControls = function(str) {
  if(str) {
    return str.replace(/[\t\r\n]/g,'');
  }
};

// Returns true if str1 starts with str2
strings.startsWith = function(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
};

// Truncates a string
// ext is optional override of default ellipsis replacement
strings.truncate = function(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
};

strings.getEntityCode_ = function(entityCharacter) {
  return '&#' + entityCharacter.charCodeAt(0) + ';';
}

// & not being escaped at the moment, intentionally
strings.escapeHTML = function(str) {
  if(str) {
    return str.replace(/[<>"”'`]/g, this.getEntityCode_);
  }
};

strings.escapeHTMLAttribute = function(str) {
  if(str) {
    return str.replace('&','&#38;').replace('"','&#34;').
      replace('\'','&#39;').replace('\\','&#92;');
  }
};

strings.escapeHTMLInputValue = function(str) {
  if(str) {
    return str.replace('"', '&#34;');
  }
};

strings.escapeHTMLHREF = function(str) {
  if(str) {
    return str.replace('"', '&#34;');
  }
};


/**
 * Strip HTML tags from a string
 * Replacement is an optional parameter, string, that is included
 * in the place of tags. Specifying a replacement works 
 * considerably slower and may differ in behavior.
 */
strings.stripTags = function(str, replacement) {
  if(str) {
    var doc = htmlParser.parse(str);

    if(replacement) {
      var it = doc.createNodeIterator(doc, NodeFilter.SHOW_TEXT),
        node, textNodes = [];
      while(node = it.nextNode()) {
        textNodes.push(node.data);
      }
      
      return textNodes.join(replacement);
    }

    // Let the browser do the work
    return doc.textContent;
  }
};

// An extremely basic tag stripping function.
// Not intended to be perfect.
strings.MATCH_TAG_ = /<.*>/g;
strings.stripTagsFast = function(str) {
  if(str) {
    return str.replace(this.MATCH_TAG_, '');
  }
};


var htmlParser = {};

htmlParser.parse = function(str) {
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;
  return doc.body;
};

htmlParser.createHTMLDocument = function(bodyHTMLString, baseURLString) {
  
  // Note: reading doc.body.innerHTML will not 
  // yield resolve urls, just the raw html put into it. 
  // However, iterating over elements affected by base and 
  // accessing attributes affected by base (such as a.href) 
  // WILL yield resolved URLs.
  
  // TODO: look into whether document.adoptNode(doc.body)
  // or importNode or importDocument when appending to 
  // UI would use resolved URLs.
  
  var doc = document.implementation.createHTMLDocument();
  
  // doc.baseURI is read-only, so we set it by appending
  // a base node. Base nodes are frowned upon but baseURI 
  // is readonly so not much of a choice.
  
  if(baseURLString) {
    var baseNode = doc.createElement('base');
    baseNode.setAttribute('href', baseURLString);
    doc.head.appendChild(baseNode);
  }
  
  doc.body.innerHTML = bodyHTMLString;
  return doc;
};


// TODO: throw an exception in parseFromString

var xml = {};
xml.parseFromString = function(str, charSet) {

  // TODO: make use of charSet?

  var parser = new DOMParser();

  var doc = parser.parseFromString(str, 'application/xml');

  // parseFromString does not throw a SyntaxError, unlike setting innerHTML 
  // Instead, like the 2001 bug in Firefox that was never closed, it generates an
  // valid XML document that contains information about the error. In both Chrome
  // and Firefox this appears as <parsererror>. We want to avoid saying this is valid 
  // so preemptively search for that and fail if its present.
  var errorElement = doc.querySelector('parsererror');
  if(errorElement) {
    
    
    console.dir(errorElement);
    return;
  }

  return doc;
};

var favIcon = {};

favIcon.DEFAULT_URL = '/img/rss_icon_trans.gif';

// Returns a URL to the favicon for the given URL
favIcon.getURL = function(url) {

  // Since I cannot seem get chrome://favicons/ working
  // (because they only appear if the page is open in 
  // another tab), we are using this simple google service
  // which works for now.

  return url ? 
    'http://www.google.com/s2/favicons?domain_url=' +
    encodeURIComponent(url) : this.DEFAULT_URL;
};


var hashing = {};

// Generate a simple hashcode from a character array
hashing.hashCode = function(arr) {
  if(arr && arr.length) {
    return arr.reduce(this.reducer_, 0);
  } 
};

// Private helper for hashCode
hashing.reducer_ = function (previousValue, currentValue) {
  return (previousValue * 31 + currentValue.charCodeAt(0)) % 4294967296;
};