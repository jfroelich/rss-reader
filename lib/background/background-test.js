// Basic feature tests

var bgtest = {};

bgtest.console = function(str) {
  return str;
};

bgtest.testRedirectDetection = function(url) {
  var manifest = chrome.runtime.getManifest();
  var request = new XMLHttpRequest();
  request.timeout = 2000;
  request.ontimeout = console.log;
  request.onabort = console.log;
  request.onerror = console.log;
  request.onload = function(event) {
    console.dir(event.target);
  };

  request.open('GET', url, true);
  request.setRequestHeader('X-Requested-With', manifest.name);
  request.send();
  return 'Sending request to ' + url;
};

bgtest.fetchFeed = function(url) {
  fetchFeed(url, function(xml){
    console.log(xml);
  }, function(event){
    console.log(event);
  });
  return 'Fetching ' + url;
};

bgtest.parseHTML = function(str) {
  return parseHTML(str);
};

bgtest.isXMLFeed = function(url) {
  fetchFeed(url, function(xmlDocument) {
    console.log(isXMLFeed(xmlDocument));
  });
  return 'Checking if ' + url + ' is an XML RSS/Atom/RDF feed';
};

bgtest.xml2Json = function(url) {
  fetchFeed(url, function(xmlDocument) {
    console.dir(xml2json(xmlDocument));
  });
  return 'Fetching ' + url + ' as a normalized JSON object';
};

bgtest.sanitizeString = function(str) {
  var doc = htmlParser.parse(str);
  var rules = contentFiltering.loadRules();
  sanitizer.sanitize(null, doc, rules);
  return doc.innerHTML;
};