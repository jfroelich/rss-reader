
// Requires: /src/dom-filter.js
// Requires: /src/net.js

function testFilterInline(url) {
  'use strict';
  net.fetchHTML(url, 20000, function(error, document, responseURL) {
    if(error) {
      console.debug(error);
      return;
    }
    DOMFilter.filterScriptElements(document);
    DOMFilter.filterJavascriptAnchors(document);
    DOMFilter.filterBlacklistedElements(document);
    DOMFilter.filterHiddenElements(document);
    DOMFilter.filterInlineElements(document);
    window.document.body.innerHTML = document.body ?
      document.body.innerHTML : document.documentElement.innerHTML;
  });
}
