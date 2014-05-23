var htmlParser = {};

htmlParser.parse = function(str) {
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;
  return doc.body;
};

htmlParser.createHTMLDocument = function(bodyHTMLString, baseURLString) {
  
  // Note: reading doc.body.innerHTML will not 
  // yield resolve urls, just the raw html put into it. 
  // However, iterating over elements affected by base and 
  // accessing attributes affected by base (such as a.href) 
  // WILL yield resolved URLs.
  
  // TODO: look into whether document.adoptNode(doc.body)
  // or importNode or importDocument when appending to 
  // UI would use resolved URLs.
  
  var doc = document.implementation.createHTMLDocument();
  
  // doc.baseURI is read-only, so we set it by appending
  // a base node. Base nodes are frowned upon but baseURI 
  // is readonly so not much of a choice.
  
  if(baseURLString) {
    var baseNode = doc.createElement('base');
    baseNode.setAttribute('href', baseURLString);
    doc.head.appendChild(baseNode);
  }
  
  doc.body.innerHTML = bodyHTMLString;
  return doc;
};