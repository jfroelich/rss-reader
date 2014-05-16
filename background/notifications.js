// Notifications lib
function showNotification(message) {
  chrome.notifications.getPermissionLevel(function(level) {
    if(level == 'granted') {
      var id = '';
      chrome.notifications.create(id, {
        'type':'basic',
        'title':'Josh\'s RSS Reader',
        'iconUrl':'img/rss_icon_trans.gif',
        'message':message
      }, function(notificationId){});
    } else {
      console.log('This extension is not authorized to show notifications.');
    }
  });
}