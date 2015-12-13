'use strict';

{

this.test = function(url) {
  const request = new XMLHttpRequest();
  request.onerror = console.error;
  request.ontimeout = console.error;
  request.onabort = console.error;
  request.onload = onload;
  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
};

function onload(event) {
  const request = event.target;
  const document = request.responseXML;
  if(!document || !document.documentElement) {
    console.error('Invalid document');
    return;
  }

  resolveDocumentURLs(document, request.responseURL);
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
  // calamine.prune();
  calamine.annotate();

  window.document.body.innerHTML = document.body ?
    document.body.innerHTML : document.documentElement.innerHTML;
}

}
