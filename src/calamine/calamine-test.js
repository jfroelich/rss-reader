// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// todo: look into using a custom devtools panel like domdistiller

'use strict';

{

this.test = function(url) {

  fetchHTML(url, undefined, onload);
};

function onload(error, document, responseURL) {

  if(error) {
    console.debug(error);
    return;
  }

  resolveDocumentURLs(document, responseURL);
  fetchImageDimensions(document, function() {
    onprep(document);
  });
}

function onprep(document) {
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
}

}
