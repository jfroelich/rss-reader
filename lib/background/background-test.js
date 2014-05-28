// Basic feature tests

var bgtest = {};

bgtest.console = function(str) {
  return str;
};

bgtest.createOPMLDocument = function() {
  var feeds = [];
  for(var i = 0; i < 10; i++) {
    feeds.push({
      title:'title'+i,
      description:'desc'+i,
      link:'link' + i,
      url:'url' + i
    });
  }

  var xmlDocument = opml.createXMLDocument(feeds);
  return xmlDocument;
};

bgtest.fetch = function(url) {
  fetcher.fetch(url, function(xml, originalContentType){
    console.dir(xml);
  }, function(event){
    console.log('Error %s', event);
  }, 5000);
  return 'Fetching ' + url;
};

bgtest.parseHTML = function(str) {
  return htmlParser.parse(str);
};

bgtest.isFeed = function(url) {
  fetcher.fetch(url, function(xmlDocument) {
    console.log('Is xml? %s', xml2json.isXMLFeed(xmlDocument));
  }, function(err) { console.log('error %s',err); }, 5000);
  return 'Checking if ' + url + ' is an XML RSS/Atom/RDF feed';
};

bgtest.asJSON = function(url) {
  fetcher.fetch(url, function(xmlDocument, originalContentType) {
    //console.log('The original contentType was "%s"', originalContentType);
    var obj = xml2json.transform(xmlDocument);
    console.dir(obj);

  },function(err) { console.log('error %s',err); }, 5000);
  return 'Fetching ' + url + ' as a normalized JSON object';
};

bgtest.sanitizeString = function(str) {
  var doc = htmlParser.parse(str);
  var rules = contentFiltering.loadRules();
  sanitizer.sanitize(null, doc, rules);
  return doc.innerHTML;
};