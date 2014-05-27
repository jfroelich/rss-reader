// URL rewriting backend functionality

// TODO: this should be using URI functions

var rewriting = {};

// Runs the url through the list of rules. Once a rule matches
// its rewritten form is returned.
rewriting.rewriteURL = function(rules, url) {
  
  // This is some ugly code, but the point is just get it working
  // for now.
  if(rules && rules.length && url) {
    var lowercaseURL = url.toLowerCase();

    for(var i = 0, len = rules.length; i < len; i++) {
      var rule = rules[i];
      var lowercasePath = rule.path.toLowerCase();

      if(strings.startsWith(lowercaseURL, lowercasePath)) {
        if(rule.param) {
          var lowercaseParam = rule.param.toLowerCase();
          
          var start = lowercaseURL.indexOf(lowercaseParam, rule.path.length + 1);
          if(start > 0) {
            var end = lowercaseURL.indexOf('&', start + rule.param.length + 1);
            if(end > 0) {
              return url.substring(start + rule.param.length + 1, end);
            } else {
              return url.substring(start + rule.param.length);
            }
          }
        } else {
          return url.substring(rule.path.length + 1);
        }
      }
    }
  }
};

rewriting.loadRules = function() {
  var str = localStorage.URL_REWRITES;
  if(!str) return [];
  var obj = JSON.parse(str);
  return obj.rules;
};

rewriting.saveRules = function(rules) {
  localStorage.URL_REWRITES = JSON.stringify({
    rules: rules || []
  });
};

rewriting.getRuleId_ = function(rule) {
  return rule.id;
};

rewriting.generateId_ = function(rules) {
  var max = collections.arrayMax(rules.map(this.getRuleId_));
  return (!max || max < 1) ? 1 : (max + 1);
};

rewriting.createRule = function(path, param) {
  var rules = rewriting.loadRules();

  if(!path) {
    console.warn('not creating url rewrite rule, invalid path %s', path);
    return;
  }

  path = path.trim().toLowerCase();
  if(param) param = param.trim().toLowerCase();

  // Generate id for the rule
  var rule = {
    id: rewriting.generateId_(rules),
    path: path,
    param: param
  };

  rules.push(rule);
  rewriting.saveRules(rules);
  chrome.runtime.sendMessage({type:'createRewriteRule',rule:rule});
};

rewriting.removeRule = function(ruleId) {
  var rules = rewriting.loadRules();
  var deletedRule;
  var newRules = rules.filter(function(rule) {
    if(rule.id == ruleId) {
      deletedRule = rule;
      return false;
    }
    return true;
  });

  rewriting.saveRules(newRules);
  chrome.runtime.sendMessage({type:'removeRewriteRule',rule:deletedRule});
};

rewriting.ruleToString = function(rule) {
  var s = rule.path;
  if(rule.param) {
    s += '?' + rule.param + '=%s';
  } else {
    s += '%s';
  }
  return s;
};