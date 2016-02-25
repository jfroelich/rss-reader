// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/net.js

// todo: look into using a custom devtools panel like domdistiller
function testCalamine(url) {
  'use strict';
  net.fetchHTML(url, 20000, function(error, document, responseURL) {
    if(error) {
      console.debug(error);
      return;
    }

    resolveDocumentURLs(document, responseURL);
    fetchImageDimensions(document, function() {
      DOMFilter.filterCommentNodes(document);
      DOMFilter.filterFrameElements(document);
      DOMFilter.filterScriptElements(document);
      DOMFilter.filterNoScriptElements(document);
      DOMFilter.filterJavascriptAnchors(document);
      DOMFilter.filterBlacklistedElements(document);
      DOMFilter.filterHiddenElements(document);

      const calamine = new Calamine();
      calamine.analyze(document);
      calamine.annotate();

      window.document.body.innerHTML = document.body ?
        document.body.innerHTML : document.documentElement.innerHTML;
    });
  });
}
