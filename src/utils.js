// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class Badge {
  static update(connection) {
    // console.debug('Updating badge');
    if(connection) {
      Entry.countUnread(connection, this._setText);
    } else {
      Database.open(function(event) {
        if(event.type === 'success') {
          Entry.countUnread(event.target.result, this._setText);
        } else {
          console.debug(event);
          chrome.browserAction.setBadgeText({text: '?'});
        }
      });
    }
  }

  static _setText(event) {
    const count = event.target.result;
    chrome.browserAction.setBadgeText({
      text: count.toString()
    });
  }
}

class Notification {

  // TODO: maybe we don't need the permission check at all?
  // what happens if we just call notifications.create without
  // permission? A basic exception? A no-op?
  static show(message) {
    chrome.permissions.contains(
      {permissions: ['notifications']}, function(permitted) {
      if(permitted) {
        const notification = {
          type: 'basic',
          title: chrome.runtime.getManifest().name,
          iconUrl: '/media/rss_icon_trans.gif',
          message: message
        };
        chrome.notifications.create('lucubrate', notification, function(){});
      }
   });
  }
}

class DateUtils {
  // Adapted from http://stackoverflow.com/questions/1353684
  static isValid(date) {
    return date && date.toString() === '[object Date]' && isFinite(date);
  }
}

class StringUtils {
  static removeTags(string, replacement) {
    if(string) {
      const doc = document.implementation.createHTMLDocument();
      doc.body.innerHTML = string;
      if(!replacement) {
        return doc.body.textContent;
      }
      const iterator = doc.createNodeIterator(
        doc.body, NodeFilter.SHOW_TEXT);
      let node = iterator.nextNode();
      const values = [];
      while(node) {
        values.push(node.nodeValue);
        node = iterator.nextNode();
      }
      return values.join(replacement);
    }
  }

  // TODO: research the proper pattern
  // /[^\x20-\x7E]+/g;
  static stripControlCharacters(string) {
    const RE_CONTROL_CHARACTER = /[\t\r\n]/g;
    if(string) {
      return string.replace(RE_CONTROL_CHARACTER,'');
    }
  }

  static truncate(string, position, extension) {
    if(string && string.length > position) {
      const ELLIPSIS = '\u2026';
      extension = extension || ELLIPSIS;
      return string.substr(0, position) + extension;
    }
    return string;
  }
}

class ArrayUtils {
  // Adapted from http://stackoverflow.com/questions/9229645
  static unique(array) {
    return [...new Set(array)];
  }
}


class URLUtils {

  static isValid(url) {
    try {
      let uri = URI(url);
      return uri && uri.protocol() && uri.hostname();
    } catch(e) {

    }

    return false;
  }

  static getSchemeless(url) {
    const uri = new URI(url);
    uri.protocol('');
    return uri.toString().substring(2);
  }

  static isDataURI(url) {
    return /^\s*data\s*:/i.test(url);
  }

  static rewrite(url) {
    const GOOGLE_NEWS = 
      /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
    const matches = GOOGLE_NEWS.exec(url);
    if(matches && matches.length === 2 && matches[1]) {
      return decodeURIComponent(matches[1]);
    }
    return url;
  }
}

class FavIcon {
  static getURL(url) {
    if(url) {
      return 'http://www.google.com/s2/favicons?domain_url=' + 
        encodeURIComponent(url);
    } else {
      return '/media/rss_icon_trans.gif';
    }
  }
}

function fadeElement(element, duration, delay, callback) {
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
