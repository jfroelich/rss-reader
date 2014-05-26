
var generalSettings = {};

generalSettings.onEnableContentFiltersChange = function(event) {
  var navContentFilters = document.getElementById('mi-content-filters');
  if(event.target.checked) {
    localStorage.ENABLE_CONTENT_FILTERS = '1';
    navContentFilters.style.display = 'block';
  } else {
    delete localStorage.ENABLE_CONTENT_FILTERS;
    navContentFilters.style.display = 'none';
  }
};

generalSettings.onEnableURLRewritingChange = function(event) {
  var navURLRewriting = document.getElementById('mi-rewriting');
  if(event.target.checked) {
    localStorage.URL_REWRITING_ENABLED = '1';
    navURLRewriting.style.display = 'block';
  } else {
    delete localStorage.URL_REWRITING_ENABLED;
    navURLRewriting.style.display = 'none';
  }
};

generalSettings.init = function(event) {
  document.removeEventListener('DOMContentLoaded', generalSettings.init);
  
  var enableContentFilters = document.getElementById('enable-content-filters');
  enableContentFilters.checked = localStorage.ENABLE_CONTENT_FILTERS ? true : false;
  enableContentFilters.onchange = generalSettings.onEnableContentFiltersChange;

  var enableURLRewriting = document.getElementById('rewriting-enable');
  enableURLRewriting.checked = localStorage.URL_REWRITING_ENABLED ? true : false;
  enableURLRewriting.onchange = generalSettings.onEnableURLRewritingChange;

};


document.addEventListener('DOMContentLoaded', generalSettings.init);