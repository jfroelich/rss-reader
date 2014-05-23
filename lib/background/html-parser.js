var htmlParser = {};

/**
 * Parses htmlString into an HTMLDocument. The returned
 * document object's root node is html, so to access just the 
 * corresponding nodes from the string, use document.body.
 */
htmlParser.parse = function(str) {

  // The problem with using createElement is that Chrome aggressively 
  // resolves resources in live elements (e.g. fetches images/css/scripts). 
  // Since we want to be able to do things with the HTMLDocument 
  // prior to ever resolving any resources, we use createHTMLDocument.

  // TODO: why am I packing it into body, why not doc root?

  // This probably works fine instead, should switch to this.
  // var frag = new DocumentFragment();
  // frag.innerHTML = str;

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;
  return doc;
};

// Retained for reference:
// var parser = new DOMParser();
// var doc = parser.parseFromString(str,'text/html');