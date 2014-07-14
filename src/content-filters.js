// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: this should maintain its own state by saving
// an array of rules in memory, instead of having caller
// pass around a rules array.
// TODO: add this functionality back into scrubbing/calamine
// this is currently not in use.
// TODO: rename to something like DOMFilterRules?

function convertContentFilterToRegex(query) {
  // Escape regexp chars (except *) and then replace * with .*
  return query.replace(/[-[\]{}()+?.\\^$|#\s]/g,'\\$&').replace(/\*+/g,'.*');
}

function translateContentFilterRule(rule) {
  if(rule.match) {
    var pattern = convertContentFilterToRegex(rule.match);

    // Recreate the regular expression object as set as
    // the property 're'
    rule.re = new RegExp(pattern, 'i');
  }
}

function loadContentFilterRules() {
  var str = localStorage.CONTENT_FILTERS;
  if(!str) return [];
  var obj = JSON.parse(str);
  obj.rules.forEach(translateContentFilterRule);
  return obj.rules;
}

function saveContentFilterRules(rules) {
  localStorage.CONTENT_FILTERS = JSON.stringify({rules: rules || []});
}

function areContentFilterRulesEqual(rule1, rule2) {

  if(rule1.id && rule2.id)
    return rule1.id == rule2.id;

  return rule1.tag === rule2.tag &&
         rule1.attr === rule2.attr &&
         rule1.match === rule2.match;
}

function getContentFilterRuleId(rule) {
  return rule.id;
}

function generateContentFilterId(rules) {
  var ids = rules.map(getContentFilterRuleId);
  var max = Math.max.apply(Math, ids);
  return max < 1 ? 1 : max + 1;
}

function createContentFilterRule(tag, attr, match) {
  var rules = loadContentFilterRules();

  var rule = {
    id: generateContentFilterId(rules),
    tag: tag,
    attr: attr,
    match: match
  };

  rules.push(rule);
  saveContentFilterRules(rules);
  return rule;
}

function removeContentFilterRule(ruleId) {
  var rules = loadContentFilterRules();
  var differentRuleId = function(rule) {
    return rule.id != ruleId;
  };

  var newRules = rules.filter(differentRuleId);
  saveContentFilterRules(newRules);
  return ruleId;
}

function contentFilterRuleToString(rule) {
  var s = '<';
  s += rule.tag ? rule.tag : 'any-tag';
  s += ' ';

  if(rule.attr) {
    s += rule.attr;
    if(rule.match) {
      s += '="' + rule.match + '"';
    }
  } else if(rule.match) {
    s += 'any-attribute="' + rule.match + '"'
  }

  s += rule.tag ? '></' + rule.tag + '>' : '/>';
  return s;
}

function testContentFilterRuleMatchesNode(rule, node) {

  if(!rule || !node) {
    return false;
  }

  if(!rule.tag || !rule.re) {
    return false;
  }

  if(node.nodeType != Node.ELEMENT_NODE) {
    return false;
  }

  if(!node.matches(rule.tag)) {
    return false;
  }

  // TODO: this should only be testing attribute if
  // rule.attr is defined?
  var attr = node.getAttribute(rule.attr);
  return rule.re.test(attr);
}

/**
 * TODO: revise this to make more sense, it works this way now
 * as an artifact of the old sanitizer code. returns true means
 * retain the node, return false means remove the node. this is
 * counter intuitive
 */
function applyContentFilterRulesToNode(node, rules) {

  if(!localStorage.ENABLE_CONTENT_FILTERS) {
    return true;
  }

  var matched = any(rules, function(rule) {
    return testContentFilterRuleMatchesNode(rule, node);
  });

  return matched ? false : true;
}
