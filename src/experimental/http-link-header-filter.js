
import * as mime from "/src/utils/mime-utils.js";

async function registerDWLinkFilterRule() {
  if(localStorage.DW_LINK_RULE_ID)
    return;
  const linkMatcher = new chrome.declarativeWebRequest.RequestMatcher({
    resourceType: ['xmlhttprequest'],
    contentType: [mime.MIME_TYPE_HTML]
  });
  const linkAction = new chrome.declarativeWebRequest.RemoveResponseHeader(
    {name: 'link'});
  const linkRule = {
    conditions: [linkMatcher],
    actions: [linkAction]
  };
  const rules = [linkRule];
  const addedRules = await addDWRules(rules);
  console.log('Added link filter dw rule with id', addedRules[0].id);
  localStorage.DW_LINK_RULE_ID = addedRules[0].id;
}

function addDWRules(rules) {
  return new Promise(function(resolve, reject) {
    return chrome.declarativeWebRequest.onRequest.addRules(rules, resolve);
  });
}

function getDWRules() {
  return new Promise(function(resolve, reject) {
    let ruleIds;
    return chrome.declarativeWebRequest.onRequest.getRules(ruleIds, resolve);
  });
}

function removeDWRules(ids) {
  return new Promise(function(resolve, reject) {
    return chrome.declarativeWebRequest.onRequest.removeRules(ids, resolve);
  });
}


// Every page load for now
// Disabled for now as buggy
//registerDWLinkFilterRule();

async function unregisterDWLinkFilterRule() {
  if(localStorage.DW_LINK_RULE_ID) {
    console.debug('Removing dw rule', localStorage.DW_LINK_RULE_ID);
    await removeDWRules([localStorage.DW_LINK_RULE_ID]);
    console.debug('Removed dw rule', localStorage.DW_LINK_RULE_ID);
    delete localStorage.DW_LINK_RULE_ID;
  } else {
    const rules = await getDWRules();
    console.debug('Removing %s dw rules', rules.length);
    for(const rule of rules) {
      console.log('DW RULE:', rule);
    }
    await removeDWRules();
    console.debug('Removed %s dw rules', rules.length);
  }
}
