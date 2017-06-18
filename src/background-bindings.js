// See license.md

'use strict';


function backgroundBindingsOnDOMContentLoaded(event) {
  chrome.browserAction.onClicked.addListener(badgeOnClick);

  chrome.runtime.onInstalled.addListener(extensionOnInstalled);

}


document.addEventListener('DOMContentLoaded',
  backgroundBindingsOnDOMContentLoaded, {'once': true});
