
var rewriting = {};


rewriting.onCreateClick = function(event) {
  
};

rewriting.onTestClick = function(event) {
    
};

rewriting.init = function(event) {
  document.removeEventListener('DOMContentLoaded', rewriting.init);

  var enableCheckbox = document.getElementById('rewriting-enable');
  enableCheckbox.checked = !!localStorage.URL_REWRITING_ENABLED;
  enableCheckbox.onchange = function(event) {
    if(event.target.checked) {
      localStorage.URL_REWRITING_ENABLED = '1';
    } else {
      delete localStorage.URL_REWRITING_ENABLED;
    }
  };
  
  var createRule = document.getElementById('rewriting-create');
  createRule.onclick = rewriting.onCreateClick;

  var testRule = document.getElementById('rewriting-test');
  testRule.onclick = rewriting.onTestClick;

  // TODO: populate the list.
  var rulesList = document.getElementById('rewrite-rules-list');
  
};

document.addEventListener('DOMContentLoaded', rewriting.init);