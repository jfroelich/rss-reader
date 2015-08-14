// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: maybe split up into separate feature files as 
// these functions are generally unrelated
// TODO: if this is just messaging, rename this into 
// a more relevant thing, like background-messages.js or 
// something
// TODO: maybe it is dumb to have certain messages handled
// here?
// TODO: maybe it is dumb to worry about unhandled messages?
// this way we wouldn't also need to react to messages that
// are no-ops, like displaySettingsChanged

var lucu = lucu || {};
lucu.background = {};

// Handle messages send to the background page
lucu.background.onMessage = function(message) {
  'use strict';

  switch(message.type) {
    case 'entryRead':
      break;
    case 'importFeedsCompleted':
      lucu.background.onImportFeedsCompleted(message);
      break;
    case 'pollCompleted':
      lucu.background.onPollCompletedMessage(message);
     break;
    case 'subscribe':
      lucu.background.onSubscribeMessage(message);
      break;
    case 'unsubscribe':
      lucu.background.onUnsubscribeMessage(message);
      break;
    case 'displaySettingsChanged':
      break;
    default:
      console.warn('Unhandled message %o', message);
      break;
  };
};


lucu.background.onImportFeedsCompleted = function(message) {
  var notification = (message.feedsAdded || 0) + ' of ';
  notification += (message.feedsProcessed || 0) + ' feeds imported with ';
  notification += message.exceptions ? message.exceptions.length : 0;
  notification += ' error(s).';
  lucu.notifications.show(notification);  
};

lucu.background.onPollCompletedMessage = function(message) {
  lucu.badge.update();
  if(!message.entriesAdded) return;
  lucu.notifications.show(message.entriesAdded + ' new articles added.');
};

lucu.background.onSubscribeMessage = function(message) {
  lucu.badge.update();
  if(!message.feed) return;
  var title = message.feed.title || message.feed.url || 'Untitled';
  lucu.notifications.show('Subscribed to ' + title);
};

lucu.background.onUnsubscribeMessage = function(message) {
  lucu.badge.update();
};



// Binds the message listener on background page load
// TODO: maybe see if there is a way for this to happen 
// only on install instead of every page load?
chrome.runtime.onMessage.addListener(lucu.background.onMessage);
