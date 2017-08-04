// See license.md
'use strict';

{ // Begin file block scope

// Trying to resolve the Link: header issue
// See https://stackoverflow.com/questions/45352300
// See https://developer.chrome.com/extensions/declarativeWebRequest
// NOTE: added declarativeWebRequest permission to manifest
// NOTE: Rules are persistent across browsing sessions. Therefore, you should
//install rules during extension installation time using the runtime.onInstalled
//event. Note that this event is also triggered when an extension is updated.
//Therefore, you should first clear previously installed rules and then register
//new rules.
// TODO: How do I test this????

/*
// Disabled until I see how to restrict to requests made by this extension
// only. Not sure but this may be intercepting all requests in chrome
//    "declarativeWebRequest",
var link_matcher = new chrome.declarativeWebRequest.RequestMatcher({
  'resourceType': ['xmlhttprequest'],
  'contentType': ['text/html']
});

var link_action = new chrome.declarativeWebRequest.RemoveResponseHeader(
  {'name': 'link'});

var link_rule = {
  'conditions': [link_matcher],
  'actions': [link_action]
};

chrome.declarativeWebRequest.onRequest.addRules([link_rule]);
*/

async function on_installed(event) {
  console.debug('chrome.runtime.onInstalled'); // Temp, debugging
  const verbose = true;

  // Set the badge text. As a side effect this will create the database
  // Non-awaited.
  ext_update_badge(verbose).catch(console.warn);

  let icon_db_name, icon_db_version;
  try {
    await favicon_setup_db(icon_db_name, icon_db_version, verbose);
  } catch(error) {
    console.warn(error);
  }
}

chrome.runtime.onInstalled.addListener(on_installed);

async function browser_action_on_click(event) {
  try {
    await ext_show_slideshow_tab();
  } catch(error) {
    console.warn(error);
  }
}

chrome.browserAction.onClicked.addListener(browser_action_on_click);

function on_alarm(alarm) {
  switch(alarm.name) {
  case 'archive':
    archive_entries().catch(console.warn);
    break;
  case 'poll':
    const flags = 0; // all off
    let idlePeriodSeconds, recencyPeriodMillis, fetchFeedTimeoutMillis,
      fetchHTMLTimeoutMillis, fetchImageTimeoutMillis;
    const promise = poll_feeds(idlePeriodSeconds, recencyPeriodMillis,
      fetchFeedTimeoutMillis, fetchHTMLTimeoutMillis,
      fetchImageTimeoutMillis, flags);
    promise.catch(console.warn);
    break;
  case 'remove-entries-missing-urls':
    remove_entries_missing_urls().catch(console.warn);
    break;
  case 'remove-orphaned-entries':
    remove_orphaned_entries().catch(console.warn);
    break;
  case 'refresh-feed-icons':
    refresh_feed_icons().catch(console.warn);
    break;
  case 'compact-favicon-db':
    let name, version, maxAgeMillis, verbose;
    favicon_compact_db(name, version, maxAgeMillis, verbose).catch(
      console.warn);
    break;
  default:
    console.warn('Unknown alarm:', alarm.name);
    break;
  }
}

chrome.alarms.onAlarm.addListener(on_alarm);

chrome.alarms.create('archive', {'periodInMinutes': 60 * 12});
chrome.alarms.create('poll', {'periodInMinutes': 60});
chrome.alarms.create('remove-entries-missing-urls',
  {'periodInMinutes': 60 * 24 * 7});
chrome.alarms.create('remove-orphaned-entries',
  {'periodInMinutes': 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons',
  {'periodInMinutes': 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {'periodInMinutes': 60 * 24 * 7});

} // End file block scope
