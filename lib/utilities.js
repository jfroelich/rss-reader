// Misc utilties

// Mimics jquery, Chrome command line api
if(typeof $ == 'undefined') {
  window.$ = function(selector,doc) {
    return (doc || document).querySelector(selector);
  };
}

if(typeof $$ == 'undefined') {
  window.$$ = function(selector,doc) {
    return (doc || document).querySelectorAll(selector);
  };
}

var util = {};

util.noop = function() {};


util.updateBadge =  function() {
  model.connect(function(db) {
    db.transaction('entry').objectStore('entry').index('unread').count(
      IDBKeyRange.only(model.UNREAD)).onsuccess = function(event) {
      var count = event.target.result || 0;
      chrome.browserAction.setBadgeText({text: count.toString()});
    };
  });
};

util.notify = function(message) {
  var manifest = chrome.runtime.getManifest();
  var options = {
    type:'basic',
    title: manifest.name || 'Untitled',
    iconUrl:'/img/rss_icon_trans.gif',
    message:message
  };

  chrome.permissions.contains({permissions: ['notifications']}, function(permitted) {
    if(permitted) {
      chrome.notifications.create('honeybadger', options, function() {});
    }
  });
};

util.each = function(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len; 
    func(obj[i++])) {
  }
};

util.reverseEach = function(obj, func) {
  var i = obj.length;
  while(i--) {
    func(obj[i]);
  }
};

util.filter = function(obj, func) {
  return Array.prototype.filter.call(obj, func);
}

// Deprecate in favor of inverted [].some?
util.until = function(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0, continues = 1; 
    continues && i < len; continues = func(obj[i++])) {
  }
};

util.until2 = function(obj, func) {
  return Array.prototype.some.call(obj, function(val) {
    return !func(val);
  });
};

// Deprecate in favor of [].some
util.any = function(obj, func) {
  return Array.prototype.some.call(obj, func);
};

// TODO: finish args
util.toArray = function(obj) {
  return Array.prototype.slice.call(obj);
};


util.values = function(obj) {
  var arr = [];
  Object.getOwnPropertyNames(obj).forEach(function(key) {
    arr.push(obj[key]);
  });
  return arr;
};


// Finds the highest number in an array of unsigned longs
// Adapted from http://stackoverflow.com/questions/11190407
util.arrayMax = function(arr) {
  if(arr && arr.length) {
    return arr.reduce(function(previousValue, currentValue) {
      return Math.max(previousValue, currentValue); 
    }, -Infinity);
  }
};

// Extremely simple date formatting
util.formatDate = function(date, sep) {
  return date? 
    [date.getMonth() + 1, date.getDate(), date.getFullYear()].join(sep || '-') : 
    '';
};

// Extremely simple date parsing.
util.parseDate = function(str) {
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

util.stripControls = function(str) {
  if(str) return str.replace(/[\t\r\n]/g,'');
};

// Returns true if str1 starts with str2
util.startsWith = function(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
};

// Truncates a string
util.truncate = function(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
};


util.escapeHTML = function(str) {
  if(str) {
    // & not being escaped at the moment, intentionally
    return str.replace(/[<>"”'`]/g, function(entityCharacter) {
      return '&#' + entityCharacter.charCodeAt(0) + ';';
    });
  }
};

util.escapeHTMLAttribute = function(str) {
  if(str) {
    return str.replace('&','&#38;').replace('"','&#34;').
      replace('\'','&#39;').replace('\\','&#92;');
  }
};

util.escapeHTMLInputValue = function(str) {
  if(str) {
    return str.replace('"', '&#34;');
  }
};

util.escapeHTMLHREF = function(str) {
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
util.stripTags = function(str, replacement) {
  if(str) {
    var doc = util.parseHTML(str);
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
};

util.parseHTML = function(str) {
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;
  return doc.body;
};

util.parseXML = function(str) {
  var parser = new DOMParser();
  
  // TODO: does this ever actually throw?
  var doc = parser.parseFromString(str, 'application/xml');

  var errorElement = $('parsererror',doc);
  if(errorElement) {
    if(errorElement.firstChild && errorElement.firstChild.nextSibling) {
      throw errorElement.firstChild.nextSibling.textContent;
    }
    throw errorElement.textContent;
  }

  return doc;
};

util.getFavIconURL = function(url) {
  return url ? 'http://www.google.com/s2/favicons?domain_url=' +
    encodeURIComponent(url) : '/img/rss_icon_trans.gif';
};

// Generate a simple hashcode from a character array
util.generateHashCode = function(arr) {
  if(arr && arr.length) {
    return arr.reduce(function (previousValue, currentValue) {
      return (previousValue * 31 + currentValue.charCodeAt(0)) % 4294967296;
    }, 0);
  } 
};

util.isAnchor = function(element) {
  return element && 
    element.__proto__ == HTMLAnchorElement.prototype;
};

util.isImage = function(element) {
  return element &&
    element.__proto__ == HTMLImageElement.prototype;
};

util.getSchemelessURL = function(url) {
  var schemeless = URI.parse(url);
  if(schemeless) {
    delete schemeless.scheme;
    return URI.toString(schemeless);
  }
};

util.key = {
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  N: 78,
  P: 80
};

util.smoothScrollToY = function(element, delta, targetY) {
  clearTimeout(util.scrollYStartTimer);
  clearInterval(util.scrollYIntervalTimer);
  
  var start = function() {
    util.scrollYIntervalTimer = setInterval(scrollY,20);
  };
  
  var scrollY = function() {
    var currentY = element.scrollTop;
    element.scrollTop += delta;
    if(currentY == element.scrollTop || element.scrollTop == targetY) {
      //console.log('STOPPING');
      clearInterval(util.scrollYIntervalTimer);
    }
  };

  util.scrollYStartTimer = setTimeout(start,5);
};