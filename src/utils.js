// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';


// Requires: /lib/URI.js
// Requires: /src/db.js
// Requires: /src/entry.js

const utils = {};

// Updates the unread count of the extension's badge. Connection is optional.
utils.updateBadgeText = function(connection) {
  if(connection) {
    countUnread(connection);
  } else {
    db_open(onConnect);
  }

  function countUnread(connection) {
    const transaction = connection.transaction('entry');
    const store = transaction.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_FLAGS.UNREAD);
    request.onsuccess = setText;
  }

  function onConnect(event) {
    if(event.type === 'success') {
      const connection = event.target.result;
      countUnread(connection);
    } else {
      console.debug(event);
      const text = {'text': '?'};
      chrome.browserAction.setBadgeText(text);
    }
  }

  function setText(event) {
    const request = event.target;
    const count = request.result || 0;
    const text = {'text': '' + count};
    chrome.browserAction.setBadgeText(text);
  }
};

utils.fadeElement = function(element, duration, delay, callback) {
  function fade_end(callback, element, event) {
    event.target.removeEventListener('webkitTransitionEnd', fade_end);
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

  // TODO: why bind here? I moved the function into this function so I
  // no longer need to do this

  if(callback) {
    const fadeEndCallback = fade_end.bind(element, callback, element);
    element.addEventListener('webkitTransitionEnd', fadeEndCallback);
  }

  // property duration function delay
  style.transition = 'opacity ' + duration + 's ease ' + delay + 's';
  style.opacity = style.opacity === '1' ? '0' : '1';
};

utils.string = {};

// Returns whether string1 is equal to string2, case-insensitive
// Assumes both arguments have the toUpperCase method
utils.string.equalsIgnoreCase = function(string1, string2) {
  if(string1 && string2) {
    return string1.toUpperCase() === string2.toUpperCase();
  }

  // e.g. is '' === '', is null === undefined etc
  return string1 === string2;
};

// Removes non-printable characters from a string
// NOTE: untested
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
utils.string.filterControlCharacters = function(string) {
  if(string) {
    return string.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  }
};

// Truncates a string at the given position, and then appends the extension
// string. An ellipsis is appended if an extension was not specified.
// TODO: how does one simply truncate without appending? The test below
// returns false for empty string so i could not use that. maybe something like
// typeof extension === 'string'?
// TODO: i just realized the callers of utils.string.truncate may be passing
// in strings with html entities. Those callers should not be using this
// function, or should resolve entities before using this function.
utils.string.truncate = function(string, position, extension) {
  const ELLIPSIS = '\u2026';
  if(string && string.length > position) {
    extension = extension || ELLIPSIS;
    return string.substr(0, position) + extension;
  }
  return string;
};

// Split the string into an array of word-like token strings. This is very
// rudimentary.
utils.string.tokenize = function(string) {
  if(!string) {
    return [];
  }
  const tokens = string.split(/s+/);
  // Filter zero-length strings
  const definedTokens = tokens.filter(function return_first(first) {
    return first;
  });
  return definedTokens;
};

utils.string.normalizeSpaces = function(inputString) {
  // The old code
  //inputString = inputString.replace(/&nbsp;/ig, ' ');
  // TODO: match all \s but not \t\r\n, then we do not need
  // to even use a replacement function?
  return inputString.replace(/\s/g, function getReplacement(match) {
    switch(match) {
      case ' ':
      case '\r':
      case '\n':
      case '\t':
        return match;
        break;
      default:
        // console.debug('Replacing:', match.charCodeAt(0));
        return ' ';
    }
  });
};

// TODO: maybe I can now use the builtin URL object to do these url utility
// functions and avoid using the URI lib
utils.url = {};

// Returns a url string without its protocol
utils.url.filterProtocol = function(urlString) {
  const uri = new URI(urlString);
  uri.protocol('');
  // Remove the leading slashes
  return uri.toString().substring(2);
};


// Returns true if the url is minimally valid
utils.url.isValid = function(urlString) {
  try {
    let uri = URI(urlString);
    return uri && uri.protocol() && uri.hostname();
  } catch(exception) { }
};
