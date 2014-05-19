// Notifications lib
(function(exports){
'use strict';

function showBasicNotificationIfPermitted(message) {
  
  var manifest = chrome.runtime.getManifest();
  
  chrome.notifications.getPermissionLevel(function(level) {
    if(level != 'granted') {
      console.log('This extension is not authorized to show notifications.');
      return;
    }

    var id = '';
    chrome.notifications.create(id, {
      'type':'basic',
      'title': manifest.name || 'Untitled',
      'iconUrl':'img/rss_icon_trans.gif',
      'message':message
    }, 
    function(notificationId){
    });

  });
}

exports.showNotification = showBasicNotificationIfPermitted;

})(this);