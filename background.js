// Code here runs on every load/reload of the background page

chrome.runtime.onInstalled.addListener(onExtensionInstalled);
updateBadge();