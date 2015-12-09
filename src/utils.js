// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: thinking more about dependency injection, would it be better
// to do something like pass EntryStore and database to updateBadge
// such that they can be mocked in testing? Something like that? Then
// maybe we want a utility that simplifies this, or want to wrap it
// up in a special object, or some type of function factory

// Updates the unread count of the extension's badge
// @param database {Database} required, dependency
// @param entryStore {EntryStore} required, dependency
// @param connection {IDBDatabase} optional, an open indexedDB connection
this.updateBadge = function(database, entryStore, connection) {
  if(connection) {
    entryStore.countUnread(connection, setBadgeText);
  } else {
    database.open(updateOnConnect.bind(null, entryStore));
  }
};

// Private helper for updateBadge
function updateOnConnect(entryStore, event) {
  if(event.type === 'success') {
    entryStore.countUnread(event.target.result, setBadgeText);
  } else {
    // indexedDB connection error
    console.debug(event);
    chrome.browserAction.setBadgeText({text: '?'});
  }
}

// Sets the badge text. Private helper for updateBadge
function setBadgeText(event) {
  const count = event.target.result;
  chrome.browserAction.setBadgeText({
    text: count.toString()
  });
}

// TODO: maybe we don't need the permission check at all?
// what happens if we just call notifications.create without
// permission? A basic exception? A no-op?
this.showNotification = function(message) {
  chrome.permissions.contains(
    {permissions: ['notifications']},
    showNotificationIfPermitted.bind(null, message));
};

function showNotificationIfPermitted(message, permitted) {
  if(!permitted) return;
  const notification = {
    type: 'basic',
    title: chrome.runtime.getManifest().name,
    iconUrl: '/media/rss_icon_trans.gif',
    message: message
  };
  chrome.notifications.create('lucubrate', notification, function(){});
}


} // END ANONYMOUS NAMESPACE


class DateUtils {
  // Adapted from http://stackoverflow.com/questions/1353684
  static isValid(date) {
    return date && date.toString() === '[object Date]' && isFinite(date);
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
