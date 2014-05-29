// TODO: throw an exception in parseFromString

var xml = {};
xml.parseFromString = function(str, charSet) {

  // TODO: make use of charSet?

  var parser = new DOMParser();

  var doc = parser.parseFromString(str, 'application/xml');

  // parseFromString does not throw a SyntaxError, unlike setting innerHTML 
  // Instead, like the 2001 bug in Firefox that was never closed, it generates an
  // valid XML document that contains information about the error. In both Chrome
  // and Firefox this appears as <parsererror>. We want to avoid saying this is valid 
  // so preemptively search for that and fail if its present.
  var errorElement = doc.querySelector('parsererror');
  if(errorElement) {
    
    
    console.dir(errorElement);
    return;
  }

  return doc;
};