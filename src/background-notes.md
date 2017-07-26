
# About

This file should only be loaded in the background page of the extension.

Handles:
* Database installation
* Creating alarms and registering alarm listeners

# TODO

* Does the install binding have to occur only after DOMContentLoaded? I think
it can simply be bound as the script is loaded? Here is the code before the
change:
document.addEventListener('DOMContentLoaded', function(event) {
  chrome.runtime.onInstalled.addListener(...);
  chrome.browserAction.onClicked.addListener(...);
}, {'once': true});
* Can I change alarm code so that alarms are only registered upon install
event instead of on every background page load?
