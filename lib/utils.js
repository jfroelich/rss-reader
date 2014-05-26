// Mimics jquery, Chrome command line api
if(typeof $ == 'undefined') {
  window.$ = function(selector) {
    return document.querySelector(selector);
  };
}

if(typeof $$ == 'undefined') {
  window.$$ = function(selector) {
    return document.querySelectorAll(selector);
  };
}