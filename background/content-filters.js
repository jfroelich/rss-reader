// Content filtering API
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

function loadAndGetRules() {
    var str = localStorage.CONTENT_FILTERS;
    if(str) {
        var obj = JSON.parse(str);
        return obj.rules || [];
    } else {
        return [];
    }
}


function saveRules(rulesArray) {
  localStorage.CONTENT_FILTERS = JSON.stringify({'rules': rulesArray || []});    
}

// Convert match text to pattern
function translateMatchToPattern(matchText) {
    // Escape regular expression syntax
    // Replace wildcard * with . or whatever
    // Replace ** with *

    // TEMP while implementing
    return null;
}

function generateRuleId(rules) {
  // We use an auto incrementing scheme?
  // Just find the highest id and then add 1. if no rules
  // exist then use 1.
  // TODO: use array.reduce or something like that to find max
  var maxId = 0;
  for(var i = 0, len = rules.length; i < len; i++) {
      if(rules[i].id > maxId) {
          maxId = rules[i].id;
      }
  }

  if(maxId == 0) {
      return 1;
  } else {
      return maxId + 1;
  }
}

function createContentFilterRule(rule) {
  var rules = loadAndGetRules();
  
  // Prep
  rule.feed = rule.feed || 0;
  rule.type = rule.type || CONTENT_FILTER_TYPES[0].value;
  rule.match = rule.match || '';

  // TODO: check expression validity. If not valid, 
  // broadcast error and return
  // maybe this function should have an error callback

  // TODO: Store the regexp in the rule
  rule.pattern = translateMatchToPattern(rule.match);

  // TODO: check that the rule does not already exist. 
  // This isn't perfect but it generally works. Equality is poorly 
  // defined for situations where two rules can work the same way.
  // Right now rule equality isn't considering whether two matches were 
  // translated to the same pattern
  
  var exists = any(rules, function(aRule) {
    return aRule.feed === rule.feed && 
      aRule.type === rule.type && 
      aRule.match === rule.match
  });
  
  if(exists) {
    console.log('Rule already exists. Should prevent?');
    // TODO: broadcast error and return?
  }

  // Set the rule's id? 
  rule.id = generateRuleId(rules);

  console.log('Storing content filter rule %s', JSON.stringify(rule));

  // Add the rule to the array
  rules.push(rule);

  // Save the rules
  saveRules(rules);

  // Broadcast creation event to views
  chrome.runtime.sendMessage({'type':'createContentFilter','rule':rule});
}

function getRuleTextualFormat(rule) {
  var str = 'Filter content for ';
  if(rule.id == 0) {
    str += 'any feed ';
  } else {
    str += 'feed ' + rule.id + ' ';
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
exports.getRuleTextualFormat = getRuleTextualFormat;
exports.createContentFilterRule = createContentFilterRule;
exports.CONTENT_FILTER_TYPES = CONTENT_FILTER_TYPES;

})(this);