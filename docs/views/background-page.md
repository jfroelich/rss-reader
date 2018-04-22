The background page script is loaded exclusively by the background page.

This page is loaded via the background page instead of directly via the scripts property in the manifest. This is because it is a es6 module and es6 modules cannot be specified in the scripts array (at least in Chrome 66).

The background.html page is configured as a dynamic page in manifest.json, meaning that it will periodically be loaded and then unloaded as needed. In other words it is not persistently live for the lifetime of the browser.

The background page is concerned with the following:
* Handling app installation and updates
* Exposing cli functionality to the console for the background page
* Cron jobs (via chrome.alarms)

### TODOs
* Consider sharing functionality between alarms and cli, both libs do roughly the same thing. Currently there is some redundancy and real similarity between the bodies of the functions in each lib. Maybe have a layer called headless-tasks that provides functions that carry out a task. Then have both the cli and alarm wakeup handlers just call out to this helper module.
* Spend some time thinking more about testing
* Configurable cron settings
