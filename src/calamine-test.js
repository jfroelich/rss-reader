
// todo: rename to calamine-test.js
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
  filterCommentNodes(document);
  filterFrameElements(document);
  filterScriptElements(document);
  filterBlacklistedElements(document);
  filterHiddenElements(document);

  const calamine = new Calamine();
  calamine.analyze(document);
  calamine.annotate();

  window.document.body.innerHTML = document.body ?
    document.body.innerHTML : document.documentElement.innerHTML;
}

}
