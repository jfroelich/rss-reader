// App lib

// Map from display names (and storage key) to CSS class names
// Also serves as a pre sorted list
var FONT_FAMILIES = {
  'Arial Sans Serif': 'arialsans',
  'Calibri':'calibri',
  'Calibri Light': 'calibri-light',
  'Cambria':'cambria',
  'Georgia':'georgia',
  'MS Sans Serif': 'mssansseerif',
  'News Cycle': 'newscycle',
  'Open Sans Regular': 'opensansreg',
  'Raleway':'raleway'
};

function unsubscribe(feedId, callback) {
  model.connect(function(db) {
    model.unsubscribe(db, feedId, function() {     
      // Update badge
      updateBadge();
      
      // Broadcast event
      chrome.runtime.sendMessage({'type':'unsubscribe', 'feed': feedId});
      
      // NOTE: why call a callback here if I am sending a message?
      // Can't the views just handle the message event? Or does the message
      // only get sent to the first view that handles it?
      if(callback) {
        callback(feedId);
      }
    });
  });
}