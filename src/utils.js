// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function updateBadge(connection) {
  'use strict';
  console.debug('Updating badge');

  if(connection) {
    countUnreadEntries(connection, setText);
  } else {
    openDatabaseConnection(function(event) {
      if(event.type !== 'success') {
        console.debug(event);
        chrome.browserAction.setBadgeText({text: '?'});
        return;
      }
      countUnreadEntries(event.target.result, setText);
    });
  }

  function setText(event) {
    const count = event.target.result;
    chrome.browserAction.setBadgeText({
      text: count.toString()
    });
  }
}

// TODO: maybe we don't need the permission check at all?
// what happens if we just call notifications.create without
// permission? A basic exception? A no-op?
function showNotification(message) {
  'use strict';
  chrome.permissions.contains({permissions: ['notifications']}, 
    function(permitted) {
    if(!permitted) return;
    const notification = {
      type: 'basic',
      title: chrome.runtime.getManifest().name,
      iconUrl: '/media/rss_icon_trans.gif',
      message: message
    };
    chrome.notifications.create('lucubrate', notification, function(){});
  });
}

function fadeElement(element, duration, delay, callback) {
  'use strict';
  if(element.style.display === 'none') {
    element.style.display = '';
    element.style.opacity = '0';
  }

  if(!element.style.opacity) {
    element.style.opacity = element.style.display === 'none' ? '0' : '1';
  }

  if(callback) {
    element.addEventListener('webkitTransitionEnd', function fadeEnd(event) {
      event.target.removeEventListener('webkitTransitionEnd', fadeEnd);
      callback(element);
    });
  }

  // property duration function delay
  element.style.transition = 'opacity '+duration+'s ease '+delay+'s';
  element.style.opacity = element.style.opacity === '1' ? '0' : '1';
}

function isValidDate(date) {
  'use strict';
  // TODO: document source (stackoverflow?)
  return date && date.toString() === '[object Date]' && isFinite(date);
}

function stripTags(string, replacement) {
  'use strict';
  if(!string) {
    return;
  }
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = string;
  if(!replacement) {
    return doc.body.textContent;
  }
  const iterator = doc.createNodeIterator(doc.body, 
    NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  const values = [];
  while(node) {
    values.push(node.nodeValue);
    node = iterator.nextNode();
  }
  return values.join(replacement);
}

// TODO: research the proper pattern
// /[^\x20-\x7E]+/g;
function stripControlCharacters(string) {
  'use strict';
  const RE_CONTROL_CHARACTER = /[\t\r\n]/g;
  if(string) {
    return string.replace(RE_CONTROL_CHARACTER,'');
  }
}

function truncate(string, position, extension) {
  'use strict';
  const ELLIPSIS = '\u2026';
  extension = extension || ELLIPSIS;

  if(string && string.length > position) {
    return string.substr(0, position) + extension;
  }
  return string;
}
