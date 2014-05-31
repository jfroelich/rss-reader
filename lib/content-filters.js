var contentFiltering = {};

contentFiltering.toRE = function(query) {
  // Escape regexp chars (except *) and then replace * with .*
  return query.replace(/[-[\]{}()+?.\\^$|#\s]/g,'\\$&').replace(/\*+/g,'.*');
};

contentFiltering.translateRule_ = function(rule) {
  if(rule.match) {
    var pattern = contentFiltering.toRE(rule.match);
    rule.re = new RegExp(pattern, 'i');
  }
};

contentFiltering.loadRules = function() {
  var str = localStorage.CONTENT_FILTERS;
  if(!str) return [];
  var obj = JSON.parse(str);
  obj.rules.forEach(this.translateRule_);
  return obj.rules;
};

contentFiltering.saveRules = function(rules) {
  localStorage.CONTENT_FILTERS = JSON.stringify({rules: rules || []});
};

contentFiltering.rulesEqual = function(rule1, rule2) {
  if(rule1.id && rule2.id) return rule1.id == rule2.id;
  return rule1.tag === rule2.tag && rule1.attr === rule2.attr && rule1.match === rule2.match; 
};

contentFiltering.getRuleId_ = function(rule) {
  return rule.id;
};

contentFiltering.generateId_ = function(rules) {
  var maxId = collections.arrayMax(rules.map(this.getRuleId_));
  return (!maxId || maxId < 1) ? 1 : (maxId + 1);  
};

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
  return ruleId;
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