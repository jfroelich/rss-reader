// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


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
      break;
    case 'pollCompleted':
     break;
    case 'subscribe':
      break;
    case 'unsubscribe':
      break;
    case 'displaySettingsChanged':
      break;
    default:
      console.warn('Unhandled message %o', message);
      break;
  };
};



// Binds the message listener on background page load
// TODO: maybe see if there is a way for this to happen 
// only on install instead of every page load?
chrome.runtime.onMessage.addListener(lucu.background.onMessage);
