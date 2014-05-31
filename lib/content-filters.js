

// TODO: since I am requiring the caller content to manage the 
// array of rules separately, consider changing this to use an 
// object like ContentFilterRuleList that has methods like load/save etc.
// and avoids passing around the rules array and avoids loading from 
// localStorage each time we create/remove. This actually seems like the 
// proper case to use an object since we have a state variable (the 
// rules array).
// Once this is an object, recognize that all we are really doing is 
// a facade over an array-like object. Expose methods that allow this to 
// be treated like an array like object by callers (like collections.each).
// Basically provide a .length property, and maybe a .item property?
// TODO: once in object form, load rules should not return the array.
// TODO: prevent the ability to create duplicate rules
// TODO: use some type of event listener instead of chrome messaging?
// but how would i notify listeners in closed tabs? Also, side note, 
// but would MutationObserver be appropriate?
// TODO: think of a better name for this namespace.

var contentFiltering = {};

// Applies rules array to HTMLDocument
contentFiltering.applyRules = function(rules, htmlDoc) {
  // See the code in sanitizer
};

// Escapes regexp chars (except *) and then replaces * with .*
contentFiltering.wildcardToRegularExpression_ = function(str) {
  return str.replace(/[-[\]{}()+?.\\^$|#\s]/g,'\\$&').replace(/\*+/g,'.*');
};

// Set the re property based on the match property value
contentFiltering.translateRule_ = function(rule) {
  if(rule.match) {
    var pattern = contentFiltering.wildcardToRegularExpression_(rule.match);
    rule.re = new RegExp(pattern, 'i');
  }
};

// Returns an array of the rules.
contentFiltering.loadRules = function() {
  var str = localStorage.CONTENT_FILTERS;
  if(!str) return [];
  var obj = JSON.parse(str);
  // JSON.stringify's deep cloning cannot 
  // serialize regexps so we augment every load
  obj.rules.forEach(this.translateRule_);
  return obj.rules;
};

// Save rules to localStorage
contentFiltering.saveRules = function(rules) {
  localStorage.CONTENT_FILTERS = JSON.stringify({
    rules: rules || []
  });
};

// Test whether two rules are "equal". 
// NOTE: Does not check if matches resolve to equivalent patterns.
contentFiltering.rulesEqual = function(rule1, rule2) {
  if(rule1.id && rule2.id) {
    return rule1.id == rule2.id;
  }

  return rule1.tag === rule2.tag &&
    rule1.attr === rule2.attr &&
    rule1.match === rule2.match; 
};

// Helper for generateId_
contentFiltering.getRuleId_ = function(rule) {
  return rule.id;
};

// Suggests the next new rule's id by adding 1 to max
// Always returns a value greater than 0.
contentFiltering.generateId_ = function(rules) {
  var maxId = collections.arrayMax(rules.map(this.getRuleId_));
  return (!maxId || maxId < 1) ? 1 : (maxId + 1);  
};

// Creates a new rule, stores it
contentFiltering.createRule = function(tag, attr, match) {
  var rules = this.loadRules();
  var rule = {id: this.generateId_(rules),tag: tag, attr: attr, match: match};
  rules.push(rule);
  this.saveRules(rules);
  return rule;
};

contentFiltering.removeRule = function(ruleId) {
  var rules = this.loadRules();
  var ruleIdNotEqualsRule = function(rule) {
    return rule.id != ruleId;
  };
  var newRules = rules.filter(ruleIdNotEqualsRule);
  this.saveRules(newRules);
  chrome.runtime.sendMessage({type:'removedContentFilterRule',rule: ruleId});
};

contentFiltering.ruleToString = function(rule) {
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
};