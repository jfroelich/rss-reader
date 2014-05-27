
var viewMessageDispatcher = {};
viewMessageDispatcher.onMessage = function(message) {
  if('displaySettingsChanged' == message.type) {
      applyEntryStylesOnchange(message);
  } else {
      
  }
}

chrome.runtime.onMessage.addListener(viewMessageDispatcher.onMessage);

function bindStylizeOnLoad(event) {
   document.removeEventListener('DOMContentLoaded', bindStylizeOnLoad);
   applyEntryStylesOnload();
}

document.addEventListener('DOMContentLoaded', bindStylizeOnLoad);