
# About

This file should only be loaded in the background page of the extension. This
installs hooks in Chrome to allow the extension to respond various events.

* Sets up the indexedDB databases
* Registers alarms
* Sets up declarativeWebRequest filters

# TODO

* Change alarm code so that alarms are only registered upon install
event instead of on every background page load?
* Make it easy to remove alarms
* maybe rename to background-page.js to clarify

# Link header issue

See https://stackoverflow.com/questions/45352300
See https://developer.chrome.com/extensions/declarativeWebRequest

NOTE: need to add declarativeWebRequest permission to manifest otherwise
chrome.declarativeWebRequest is undefined

Copied text from google documentation: Rules are persistent across browsing
sessions. Therefore, you should install rules during extension installation
time using the runtime.onInstalled event. Note that this event is also
triggered when an extension is updated. Therefore, you should first clear
previously installed rules and then register new rules.

TODO: I am occasionally seeing failed fetch messages. The rule may be doing
something strange.
TODO: restrict to only requests made by this extension, or find out if this is
by default

TODO: restrict to preventing script, allow css and image, because some of my
fetches are for that purpose

NOTE: even with current code active the errors still appear.

# TODO: Try not to rely on chrome extension features

* Avoid relying on chrome.alarms if possible. Is there a non chrome specific
way to do alarms? setInterval would not allow the page to unload. Nor would it
wake up the background page?

# Better alarm management

* Gracefully manage background alarms. Create a graceful way to rename/remove
alarms. Right now if I stop using an alarm it remains silently persistent
somewhere in chrome.alarms internal state, indefinitely.
