
// TODO: remove the permissions check

var notifications = {};

notifications.show = function(message) {
  var manifest = chrome.runtime.getManifest();
  var id = '';
    
  var options = {
    type:'basic',
    title: manifest.name || 'Untitled',
    iconUrl:'img/rss_icon_trans.gif',
    message:message
  };
    
  var oncomplete = function(notificationId) {};
    
  chrome.notifications.create(id, options, oncomplete);
};