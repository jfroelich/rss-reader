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

var CONTENT_FILTER_TYPES = [
  {'value':'a-href-matches','text':'Link location'},
  {'value':'img-src-matches','text':'Image location'},
  {'value':'img-or-link-src-matches','text':'Link/image location'},
  {'value':'text-matches','text':'Inner text'},
  {'value':'element-id-matches','text':'Element ID'},
  {'value':'any-attribute-matches','text':'Any tag attribute'}
];

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

function createContentFilterRule(rule) {
  var rules = loadAndGetRules();
  
  // Prep
  rule.feed = rule.feed || 0;
  rule.type = rule.type || CONTENT_FILTER_TYPES[0].value;
  rule.match = rule.match || '';

  // TODO: check expression validity. If not valid, 
  // broadcast error and return
  // maybe this function should have an error callback?

  // Check if exists. Note this ignores whether two or more matches
  // translate to the same pattern
  
  var exists = any(rules, function(aRule) {
    return aRule.feed === rule.feed && 
      aRule.type === rule.type && 
      aRule.match === rule.match
  });
  
  if(exists) {
    console.log('Rule already exists. Should prevent?');
    // TODO: broadcast error and return?
    // call on error, or send an error message?
    // For now, allow duplicate rules
  }

  rule.id = generateRuleId(rules);
  
  var maxId = arrayMax(rules.map(function(rule) { 
    return rule.id; 
  }));
  rule.id = (!maxId || maxId < 1) ? 1 : (maxId + 1);
  
  console.log('Storing content filter rule %s', JSON.stringify(rule));
  rules.push(rule);
  saveRules(rules);
  chrome.runtime.sendMessage({'type':'createContentFilter','rule':rule});
}

function removeContentFilter(ruleId) {
  
  console.log('Removing content filter rule with id %s', ruleId);
  
  var rules = loadAndGetRules();
  
  // Could use splice and such, but this is roughly
  // the same thing
  var newRules = rules.filter(function(rule) {
    return rule.id != ruleId;
  });
  
  saveRules(newRules);
  
  chrome.runtime.sendMessage({'type':'removedContentFilterRule', 'rule': ruleId});
}


function getRuleTextualFormat(rule) {
  var str = 'Filter content for ';
  if(rule.feed == 0) {
    str += 'any feed ';
  } else {
    str += 'feed ' + rule.feed + ' ';
  }
  
  if(rule.type == 'a-href-matches') {
    str += 'containing a link with a location that matches ';
  } else if(rule.type == 'img-src-matches') {
    str += 'containing an image with a location that matches ';
  } else if(rule.type == 'img-or-link-src-matches') {
    str += 'containing a link or an image with a location that matches ';
  } else if(rule.type == 'text-matches') {
    str += 'containing an element that contains text that matches ';
  } else if(rule.type == 'element-id-matches') {
    str += 'containing an element with an ID attribute that matches ';
  } else if(rule.type == 'any-attribute-matches') {
    str += 'containing an element where any attribute matches ';
  }

  str += 'the pattern "' + rule.match + '".';
  return str;
}

exports.getContentFilterRules = loadAndGetRules;
exports.removeContentFilter = removeContentFilter;
exports.getRuleTextualFormat = getRuleTextualFormat;
exports.createContentFilterRule = createContentFilterRule;
exports.CONTENT_FILTER_TYPES = CONTENT_FILTER_TYPES;

})(this);