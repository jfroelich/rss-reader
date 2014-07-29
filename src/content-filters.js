// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

// TODO: this still needs a lot of cleanup.
// TODO: consider ContentFilterRule class, moving per rule methods to it.

// constructor. Note that this does not initialize the rules array,
// and should be followed by a call to load
lucu.ContentFilterList = function() {

  // An in memory set of loaded rules
  this.rules;
};

// Create a RegExp from a query string
lucu.ContentFilterList.prototype.toRegExp = function(query) {

  // just throw if query undefined, not string, etc.

  // Escape regexp syntax (except *)
  var escaped = query.replace(/[-[\]{}()+?.\\^$|#\s]/g, '\\$&');

  // Replace * with .*
  // Treat consecutive *s as single *
  escaped = escaped.replace(/\*+/g, '.*');

  var pattern = new RegExp(escaped, 'i');
  return pattern;
};

// Set rule.re by translating rule.match
// Necessary because we must unmarshall regexps every time on load because
// regexps are not serializable part of json which is how content filters
// are saved
lucu.ContentFilterList.prototype.setRegExp = function(rule) {

  // Ignore rule if match undefined
  if(!rule.match) {
    return;
  }

  // NOTE: expects this instanceof ContentFilterList
  // or do I need to use lucu.ContentFilterList.prototype.toRegExp?
  var buildPattern = this.toRegExp;

  // Set the 're' property.
  // TODO: ideally this function would be side-effect free?
  rule.re = buildPattern(rule.match);
};

// Sets up the internal rules array by loading from localStorage
// NOTE: repeated calls will just overwrite the previous rules array
// in memory in the member variable of the ContentFilterList instance
lucu.ContentFilterList.prototype.load = function() {
  var string = localStorage.CONTENT_FILTERS;

  // Expects this instanceof ContentFilterList

  // Initialize to empty array if no rules found
  if(!string) {
    this.rules = [];
    return;
  }

  var object = JSON.parse(string);

  // TODO: it would be better to use map here, which means
  // setRegExp should be redesigned as a side-effect-free
  // function that clones the input rule and sets a property
  // of the output rule
  object.rules.forEach(this.setRegExp);
  this.rules = object.rules;
};

// NOTE: unlike the old method, this saves the internal list member
// variable and not a parameter to a function
lucu.ContentFilterList.prototype.save = function() {

  // Expects this instanceof ContentFilterList

  var rules = this.rules || [];

  // TODO: because Array is subclass of Object, is it possible to
  // directly serialize an array? In other words, can we just pass
  // this.rules to JSON.stringify?

  // Wrap the rule array in an object so that we can call JSON.stringify on it
  var ruleWrapper = {rules: rules};

  var serialized = JSON.stringify(ruleWrapper);

  localStorage.CONTENT_FILTERS = serialized;
};

lucu.ContentFilterList.prototype.areRulesEqual = function(rule1, rule2) {
  if(rule1.id && rule2.id)
    return rule1.id == rule2.id;

  return rule1.tag === rule2.tag &&
         rule1.attr === rule2.attr &&
         rule1.match === rule2.match;
};

lucu.ContentFilterList.prototype.getRuleId = function(rule) {
  return rule.id;
};

lucu.ContentFilterList.prototype.generateId = function() {

  if(!this.rules || !this.rules.length) {
    return 1;
  }

  var ids = this.rules.map(this.getRuleId);
  var max = Math.max.apply(Math, ids);
  return max < 1 ? 1 : max + 1;
};

lucu.ContentFilterList.prototype.createRule = function(tag, attr, match) {

  var rule = {};
  rule.id = this.generateId();
  rule.tag = tag;
  rule.attr = attr;
  rule.match = match;

  // NOTE: this does not set re.

  // NOTE: this pushes the rule in mem, but does not serialize

  this.rules.push(rule);
  return rule;
};

lucu.ContentFilterList.prototype.testRuleNotHasId = function(id, rule) {
  return rule.id != id;
}

lucu.ContentFilterList.prototype.removeById = function(id) {

  var predicate = this.testRuleNotHasId.bind(this, id);

  var newRules = this.rules.filter(predicate);
  this.rules = newRules;

  return id;
};

lucu.ContentFilterList.prototype.ruleToString = function(rule) {
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

lucu.ContentFilterList.prototype.ruleMatchesNode = function(node, rule) {

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
};

lucu.ContentFilterList.prototype.matches = function(node) {
   // TODO: revise this to make more sense, it works this way now
   // as an artifact of the old sanitizer code. returns true means
   // retain the node, return false means remove the node. this is
   // counter intuitive

  if(!localStorage.ENABLE_CONTENT_FILTERS) {
    return true;
  }

  if(!this.rules || !this.rules.length) {
    return true;
  }

  var matches = this.ruleMatchesNode.bind(this, node);
  var anyMatches = this.rules.some(matches);
  return anyMatches ? false : true;
};
