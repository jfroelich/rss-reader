'use strict';

(function(exports) {

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


exports.register_dw_link_filter_rule = register_dw_link_filter_rule;
exports.unregister_dw_link_filter_rule = unregister_dw_link_filter_rule;

}(this));

/*
NOTE: not currently included in manifest.json, never got it working


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
*/
