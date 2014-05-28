// TODO: refactor opml.js to use xml.parseFromString to avoid a DRY violation

var xml = {};


xml.parseFromString = function(str) {

  // Parsing as HTML.
  // var htmlDocument = document.implementation.createHTMLDocument();
  // htmlDocument.body.innerHTML = str;
  // The above parsing does not work as expected when encountering tags
  // like <atom:link ... />, after which, it shoves all of the remaining 
  // nodes in the document into it. No syntax error is thrown and a DOM 
  // is produced, just not the desired DOM.

  // Parsing  by setting innerHTML of a node in an XMLDocument.
  // var xmlDocument = document.implementation.createDocument(null,null);
  // var wrapper = xmlDocument.createElement('wrapper');
  // xmlDocument.appendChild(wrapper);
  // try {
  //   wrapper.innerHTML = str;  
  // } catch(exception) {
  //   console.dir(exception.message);
  // }
  // This just throws a syntax error (an actual Javascript exception) about 
  // invalid XML every time.


  // Parsing using DOMParser
  // This appears to work even when a syntax error occurs
  // doc.cookie shows up as [Exception: DOMException] in chrome.console
  // documentElement is the desired root element
  // It does not choke on <atom:link/> as desired

  var parser = new DOMParser();
  var doc = parser.parseFromString(str, 'application/xml');

  // parseFromString does not throw a SyntaxError, unlike how setting innerHTML 
  // of a node in an XMLDocument does.
  // Instead, like the 2001 bug in Firefox that was never closed, it generates an
  // valid XML document that contains information about the error. In both Chrome
  // and Firefox this appears as <parsererror>. We want to avoid saying this is valid 
  // so preemptively search for that and fail if its present.
  var errorElement = doc.querySelector('parsererror');
  if(errorElement) {
    // TODO: throw an exception here containing the desired message.
    console.dir(errorElement);
    return;
  }

  return doc;
};