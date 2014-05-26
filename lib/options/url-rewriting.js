
var rewriting = {};

rewriting.app = chrome.extension.getBackgroundPage();

rewriting.onCreateClick = function(event) {
  
  var elementPath = document.getElementById('rewriting-create-path');
  var elementParameter = document.getElementById('rewriting-create-parameter');

  var path = elementPath.value || '';
  var param = elementParameter.value || '';
  path = path.trim();
  param = param.trim();

  if(!path) {
    alert('Base URL is required. Rewrite rule not created.');
    return;
  }
  
  var testURL = rewriting.app.URI.parse(path);
  if(!rewriting.app.URI.isValid(testURL)) {
    alert('Invalid Base URL. Rewrite rule not created. Check that you did not use spaces');
    return;
  }

  rewriting.app.rewriting.createRule(path, param);
  
  elementPath.value = '';
  elementParameter.value = '';
};

rewriting.onTestClick = function(event) {
  var elementInput = document.getElementById('rewriting-test-input');
  var inputValue = elementInput.value || '';
  inputValue = inputValue.trim();
  if(!inputValue) {
    return;
  }
  
  var rules = rewriting.app.rewriting.loadRules();
  var outputValue = rewriting.app.rewriting.rewriteURL(rules, inputValue);
  var elementOutput = document.getElementById('rewriting-test-output');

  if(outputValue) {
    elementOutput.value = outputValue;
  } else {
    elementOutput.value = 'No match';
  }
  
};

rewriting.onRemoveClick = function(event) {
  if(event.target.localName != 'button') {
    return;
  }

  event.currentTarget.removeEventListener('click', rewriting.onRemoveClick);
  var ruleId = parseInt(event.currentTarget.getAttribute('rule'));  
  rewriting.app.rewriting.removeRule(ruleId);
};

rewriting.onRuleCreated = function(event) {
  if(event.type != 'createRewriteRule') {
    return;
  }
  
  var rule = event.rule;

  var elementRuleList = document.getElementById('rewrite-rules-list');
  var elementListItem = document.createElement('li');
  elementListItem.setAttribute('rule', rule.id);
  elementListItem.textContent = rewriting.app.rewriting.ruleToString(rule);
  elementListItem.onclick = rewriting.onRemoveClick;
  
  var elementRemove = document.createElement('button');
  elementRemove.textContent = 'Remove';
  elementListItem.appendChild(elementRemove);
  
  elementRuleList.appendChild(elementListItem);
};

rewriting.onRuleRemoved = function(event) {
  if(event.type != 'removeRewriteRule') {
    return;
  }
  
  var rule = event.rule;
  var element = document.querySelector('ul#rewrite-rules-list li[rule="'+rule.id+'"]');
  element.parentNode.removeChild(element);
};

rewriting.init = function(event) {
  document.removeEventListener('DOMContentLoaded', rewriting.init);

  document.getElementById('rewriting-create').onclick = rewriting.onCreateClick;
  document.getElementById('rewriting-test').onclick = rewriting.onTestClick;

  // TODO: populate the list.
  var rulesList = document.getElementById('rewrite-rules-list');
  
  var rules = rewriting.app.rewriting.loadRules();
  rules.forEach(function(rule) {
    var listItem = document.createElement('li');
    listItem.textContent = rewriting.app.rewriting.ruleToString(rule);
    var removeButton = document.createElement('button');
    removeButton.value = rule.id;
    removeButton.textContent = 'Remove';
    listItem.setAttribute('rule', rule.id);
    listItem.appendChild(removeButton);
    listItem.onclick = rewriting.onRemoveClick;
    rulesList.appendChild(listItem);
  });
};

//createRewriteRule
chrome.runtime.onMessage.addListener(rewriting.onRuleCreated);
chrome.runtime.onMessage.addListener(rewriting.onRuleRemoved);
document.addEventListener('DOMContentLoaded', rewriting.init);