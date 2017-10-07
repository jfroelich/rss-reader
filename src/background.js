(function(exports) {

'use strict';


async function register_dw_link_filter_rule() {
  if(localStorage.DW_LINK_RULE_ID)
    return;
  const link_matcher = new chrome.declarativeWebRequest.RequestMatcher({
    'resourceType': ['xmlhttprequest'],
    'contentType': ['text/html']
  });
  const link_action = new chrome.declarativeWebRequest.RemoveResponseHeader(
    {'name': 'link'});
  const link_rule = {
    'conditions': [link_matcher],
    'actions': [link_action]
  };
  const rules = [link_rule];
  const added_rules = await add_dw_rules(rules);
  console.log('Added link filter dw rule with id', added_rules[0].id);
  localStorage.DW_LINK_RULE_ID = added_rules[0].id;
}

function add_dw_rules(rules) {
  return new Promise(function(resolve, reject) {
    return chrome.declarativeWebRequest.onRequest.addRules(rules, resolve);
  });
}

function get_dw_rules() {
  return new Promise(function(resolve, reject) {
    let rule_ids;
    return chrome.declarativeWebRequest.onRequest.getRules(rule_ids, resolve);
  });
}

function remove_dw_rules(ids) {
  return new Promise(function(resolve, reject) {
    return chrome.declarativeWebRequest.onRequest.removeRules(ids, resolve);
  });
}


// Every page load for now
// Disabled for now as buggy
//register_dw_link_filter_rule();

async function unregister_dw_link_filter_rule() {
  if(localStorage.DW_LINK_RULE_ID) {
    console.debug('Removing dw rule', localStorage.DW_LINK_RULE_ID);
    await remove_dw_rules([localStorage.DW_LINK_RULE_ID]);
    console.debug('Removed dw rule', localStorage.DW_LINK_RULE_ID);
    delete localStorage.DW_LINK_RULE_ID;
  } else {
    const rules = await get_dw_rules();
    console.debug('Removing %s dw rules', rules.length);
    for(const rule of rules)
      console.log('DW RULE:', rule);
    await remove_dw_rules();
    console.debug('Removed %s dw rules', rules.length);
  }
}

async function on_installed(event) {
  console.debug('chrome.runtime.onInstalled'); // Temp, debugging

  // Init the badge text. As a side effect this will create the database
  // Non-awaited.
  extension_update_badge_text();

  let icon_db_name, icon_db_version;
  try {
    await favicon.setup(icon_db_name, icon_db_version);
  } catch(error) {
    DEBUG(error);
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
  console.log('Alarm wokeup:', alarm.name);

  switch(alarm.name) {
  case 'archive':
    archive_entries().catch(console.warn);
    break;
  case 'poll':
    const flags = 0; // all off
    let idle_period_secs, recency_period_ms, fetch_feed_timeout_ms,
      fetch_html_timeout_ms, fetch_image_timeout_ms;
    const promise = poll_feeds(idle_period_secs, recency_period_ms,
      fetch_feed_timeout_ms, fetch_html_timeout_ms,
      fetch_image_timeout_ms, flags);
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
    let name, version, max_age_ms;
    favicon.compact(name, version, max_age_ms).catch(console.warn);
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


exports.register_dw_link_filter_rule = register_dw_link_filter_rule;
exports.unregister_dw_link_filter_rule = unregister_dw_link_filter_rule;

}(this));
