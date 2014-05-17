// HTML parsing lib
(function(exports){
'use strict';

/**
 * Parses htmlString into an HTMLDocument. Note that the 
 * string should not already contain html/body. The returned
 * document object's root node is html, so to access just the 
 * corresponding nodes from the string, use document.body.
 */
exports.parseHTML = function(htmlString) {
  // Instead of using a full fledged parser
  // we try and use the native methods
    
  // Documents can also be parsed this way. Leaving this 
  // here as a reference.
  // var parser = new DOMParser();
  // var doc = parser.parseFromString(htmlString,'text/html');
  
  // The problem with using createElement is that Chrome aggressively 
  // resolves resources in live elements (e.g. fetches images/css/scripts). 
  // Since we want to be able to do things with the HTMLDocument 
  // prior to ever resolving any resources, we use createHTMLDocument.
  
  // Create an untitled document
  var doc = document.implementation.createHTMLDocument();
  
  // Use the innerHTML trick
  doc.body.innerHTML = htmlString;
  
  // Return the entire document. 
  return doc;
};

})(this);