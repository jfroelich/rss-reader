// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /lib/URI.js

// Misc. utility functions
const utils = {};

utils.fadeElement = function(element, duration, delay, callback) {
  'use strict';

  function fadeEnd(callback, element, event) {
    event.target.removeEventListener('webkitTransitionEnd', fadeEnd);
    callback(element);
  }

  const style = element.style;

  if(style.display === 'none') {
    style.display = '';
    style.opacity = '0';
  }

  if(!style.opacity) {
    style.opacity = style.display === 'none' ? '0' : '1';
  }

  if(callback) {
    const fadeEndCallback = fadeEnd.bind(element, callback, element);
    element.addEventListener('webkitTransitionEnd', fadeEndCallback);
  }

  // property duration function delay
  style.transition = 'opacity ' + duration + 's ease ' + delay + 's';
  style.opacity = style.opacity === '1' ? '0' : '1';
};

utils.filterArticleTitle = function(title) {
  'use strict';
  if(!title)
    return;
  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;
  const trailingText = title.substring(index + 1);
  const terms = utils.tokenize(trailingText);
  if(terms.length < 5) {
    const newTitle = title.substring(0, index).trim();
    return newTitle;
  }
  return title;
};

// Removes various binary characters from a string
utils.filterControlCharacters = function(string) {
  'use strict';
  if(string) {
    return string.replace(/[\t\r\n]/g, '');
  }
  return string;
};

// Returns a url string without its protocol
utils.filterURLProtocol = function(url) {
  'use strict';
  const uri = new URI(url);
  uri.protocol('');
  // Remove the leading slashes before returning
  return uri.toString().substring(2);
};

// A quick and dirty way to get a formatted date
utils.formatDate = function(date, delimiter) {
  'use strict';
  if(!date) {
    return '';
  }
  const parts = [];
  parts.push(date.getMonth() + 1);
  parts.push(date.getDate());
  parts.push(date.getFullYear());
  return parts.join(delimiter || '');
};

utils.getFavIconURL = function(url) {
  'use strict';

  if(url) {
    return 'http://www.google.com/s2/favicons?domain_url=' +
      encodeURIComponent(url);
  } else {
    return '/images/rss_icon_trans.gif';
  }
};

// Returns the value of a dom node
utils.getNodeValue = function(node) {
  'use strict';
  return node.nodeValue;
};

utils.identity = function(value) {
  'use strict';
  return value;
};

utils.isObjectURL = function(url) {
  'use strict';
  return /^\s*data\s*:/i.test(url);
};

// See http://stackoverflow.com/questions/1353684
utils.isValidDate = function(date) {
  'use strict';
  return date && date.toString() === '[object Date]' && isFinite(date);
};

// Returns true if the url is minimally valid
utils.isValidURL = function(url) {
  'use strict';
  try {
    let uri = URI(url);
    return uri && uri.protocol() && uri.hostname();
  } catch(e) {}
};

utils.parseHTML = function(html) {
  'use strict';
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = html;
  return doc;
};

// Returns a new string where html elements were replaced with the optional
// replacement string.
utils.replaceHTML = function(inputString, replacement) {
  'use strict';
  let outputString = null;
  if(inputString) {
    const document = utils.parseHTML(inputString);
    if(replacement) {
      const nodes = utils.selectTextNodes(document);
      const values = nodes.map(utils.getNodeValue);
      outputString = values.join(replacement || '');
    } else {
      outputString = document.documentElement.textContent;
    }
  }

  return outputString;
};

// Returns a resolved url
utils.resolveURL = function(baseURL, url) {
  'use strict';
  try {
    const uri = new URI(url);
    if(!uri.protocol()) {
      const resolved = uri.absoluteTo(baseURL).toString();
      return resolved;
    }
  } catch(exception) {
    console.debug('Exception resolving url "%s": %o', url, exception);
  }

  return url;
};

// Applies a set of rules to a url string and returns a modified url string
utils.rewriteURL = function(url) {
  'use strict';
  const GOOGLE_NEWS =
    /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  const matches = GOOGLE_NEWS.exec(url);
  if(matches && matches.length === 2 && matches[1]) {
    return decodeURIComponent(matches[1]);
  }
  return url;
};

// Returns a static array of all text nodes in a document
utils.selectTextNodes = function(document) {
  'use strict';
  const nodes = [];
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {
    nodes.push(node);
    node = iterator.nextNode();
  }
  return nodes;
};

utils.showNotification = function(message) {
  'use strict';

  const notification = {
    type: 'basic',
    title: chrome.runtime.getManifest().name,
    iconUrl: '/images/rss_icon_trans.gif',
    message: message
  };

  const callback = function() {};

  const show = function(permitted) {
    if(!permitted)
      return;
    chrome.notifications.create('lucubrate', notification, callback);
  };

  chrome.permissions.contains({permissions: ['notifications']}, show);
};

utils.scrollElementTo = function(element, deltaY, targetY) {
  'use strict';
  let scrollYStartTimer; // debounce
  let scrollYIntervalTimer; // incrementally move
  let amountToScroll = 0;
  let amountScrolled = 0;

  return function() {
    clearTimeout(scrollYStartTimer);
    clearInterval(scrollYIntervalTimer);
    scrollYStartTimer = setTimeout(startScrolling, 5);
  }();

  function startScrolling() {
    amountToScroll = Math.abs(targetY - element.scrollTop);
    amountScrolled = 0;

    if(amountToScroll === 0) {
      return;
    }

    scrollYIntervalTimer = setInterval(scrollToY,20);
  }

  function scrollToY() {
    const currentY = element.scrollTop;
    element.scrollTop += deltaY;
    amountScrolled += Math.abs(deltaY);
    if(currentY === element.scrollTop || amountScrolled >= amountToScroll) {
      clearInterval(scrollYIntervalTimer);
    }
  }
};

// Split the string into an array of words
utils.tokenize = function(string) {
  'use strict';
  const WHITESPACE_PATTERN = /s+/;
  const tokens = string.split(WHITESPACE_PATTERN);
  const definedTokens = tokens.filter(utils.identity);
  return definedTokens;
};

// Truncates a string at the given position, and then appends the extension
// string. An ellipsis is appended if an extension was not specified.
utils.truncateString = function(string, position, extension) {
  'use strict';
  const ELLIPSIS = '\u2026';
  if(string && string.length > position) {
    extension = extension || ELLIPSIS;
    return string.substr(0, position) + extension;
  }
  return string;
};

// Updates the unread count of the extension's badge
utils.updateBadge = function(connection) {
  'use strict';

  const setBadgeText = function(event) {
    const count = event.target.result || '?';
    const countString = '' + count;
    chrome.browserAction.setBadgeText({
      text: countString
    });
  };

  const onConnect = function(event) {
    if(event.type === 'success') {
      const connection = event.target.result;
      db.countUnreadEntries(connection, setBadgeText);
    } else {
      console.debug(event);
      chrome.browserAction.setBadgeText({text: '?'});
    }
  };

  if(connection) {
    db.countUnreadEntries(connection, setBadgeText);
  } else {
    db.open(onConnect);
  }
};
