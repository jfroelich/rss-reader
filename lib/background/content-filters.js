// Content filtering API
// TODO: rather than test each pattern separately, I wonder if I could
// join the patterns into a single regexp and do a union-based search?
// A single pass approach seems better? Maybe store a single 'joined 
// regexp' property in the rules object and do not use the raw array?
// It would be created when the rules are loaded. For now I want to 
// debug rules separately

// Note: * wont match spaces, I am using .*, not .* or space

(function(exports){
'use strict';

function applyContentFilterRules(rules, htmlDoc) {
  rules.forEach(function(rule) {
    // Walk the dom and see if the rule matches
    // Maybe sanitize should be doing this since I am once again
    // dealing with mutation while walking the DOM, and run into the case
    // where I want to remove nodes but continue iterating.
    // So I would need to be able to pass the rules 
    // into the sanitizer. So the caller would worry about 
    // initialization
  });
}

function loadAndGetRules() {
  var str = localStorage.CONTENT_FILTERS;
  if(!str) return [];
  var obj = JSON.parse(str);
  if(obj && obj.rules) {
    // Create regexp objects on load
    obj.rules.forEach(function(rule) {
      if(rule.match) {
        var pattern = rule.match.replace(/[-[\]{}()+?.\\^$|#\s]/g, "\\$&").replace(/\*+/g,'.*');
        rule.re = new RegExp(pattern, 'i');
      }
    });
    return obj.rules;
  }

  return [];
}

function saveRules(rulesArray) {
  // Note: stringify simply ignores RegExps
  localStorage.CONTENT_FILTERS = JSON.stringify({'rules': rulesArray || []});    
}

/** 
 * Test for approximate rule equality. Does not compare id, 
 * and does not check if matches resolve to 
 * equivalent patterns. Only checks tag, attr, and match values.
 */
function ruleEquals(rule1, rule2) {
  return rule1.tag === rule2.tag &&
    rule1.attr === rule2.attr &&
    rule1.match === rule2.match;
}

/**
 * Suggests what the next id should be for a 
 * new rule. This is 1 + the current maximum. If there
 * are no rules, then the new id is 1.
 */
function generateNewRuleId(rules) {
  var maxId = arrayMax(rules.map(function(rule) { 
    return rule.id; 
  }));
  return (!maxId || maxId < 1) ? 1 : (maxId + 1);
}

/**
 * Creates a new rule, stores it, and broadcasts a rule created event
 *
 * TODO: prevent duplicate rule creation
 */
function createContentFilterRule(rule) {
  var rules = loadAndGetRules();

  //var exists = any(rules, function(existingRule){
  //  return ruleEquals(existingRule, rule);
  //});
  //if(exists) {
    // TODO: broadcast error and return?
    // call on error, or send an error message?
  //}

  // Set the rule's id
  rule.id = generateNewRuleId(rules);
  rules.push(rule);
  saveRules(rules);
  chrome.runtime.sendMessage({'type':'createContentFilter','rule':rule});
}

/**
 * Deletes a rule with the given id and then broadcasts a rule
 * deleted event.
 *
 * TODO: pretty sure there is a better method than filtering into a new array. 
 * Look into splice.
 */
function removeContentFilter(ruleId) {
  var rules = loadAndGetRules();

  var newRules = rules.filter(function(rule) {
    return rule.id != ruleId;
  });

  saveRules(newRules);
  chrome.runtime.sendMessage({'type':'removedContentFilterRule', 'rule': ruleId});
}

/**
 * Gets a (sort of) user-friendly representation of a rule
 */
function getRuleTextualFormat(rule) {
  return 'Tag: ' + rule.tag + ', Attribute: ' + rule.attr + ', Match: ' + rule.match;
}

exports.getContentFilterRules = loadAndGetRules;
exports.removeContentFilterRule = removeContentFilter;
exports.getRuleTextualFormat = getRuleTextualFormat;
exports.createContentFilterRule = createContentFilterRule;
})(this);