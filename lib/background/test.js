// Run basic tests on the background page.

var test = {};

test.updateFeed = function(url) {
  //http://news.google.com/news?pz=1&cf=all&ned=us&hl=en&output=rss
  
  // To call update we have to connect and load first to get id
  // and such.
  
  var uri = URI.parse(url);
  delete uri.scheme;
  var schemeless = URI.toString(uri);
  
  model.connect(function(db) {
    db.transaction('feed').objectStore('feed').index('schemeless').get(schemeless).onsuccess = function() {
      
      console.log('Testing update of feed id %s url %s', this.result.id, this.result.url);
      
      var feed = this.result;
      
      var params = {};
      params.feedId = feed.id;
      params.url = url;
      params.db = db;
      params.fetch = true;
      params.notify = false;
      params.onerror = function(err) {
        console.log('test error %s', err);
      };
      params.timeout = 1000;
      params.oncomplete = function(feed, p, a) {
        console.log('test completed processed %s added %s',p,a);
      };

      subscriptions.update(params);
    };
  }); 
  
  return 'Testing update ' + url;
};


test.console = function(str) {
  return str;
};

test.createOPMLDocument = function() {
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

test.fetch = function(url) {
  subscriptions.request(url, function(xml, originalContentType){
    console.dir(xml);
  }, function(event){
    console.log('Error %s', event);
  }, 5000);
  return 'Fetching ' + url;
};

test.parseHTML = function(str) {
  return htmlParser.parse(str);
};

test.isFeed = function(url) {
  subscriptions.request(url, function(xmlDocument) {
    console.log('Is xml? %s', xml2json.isXMLFeed(xmlDocument));
  }, function(err) { console.log('error %s',err); }, 5000);
  return 'Checking if ' + url + ' is an XML RSS/Atom/RDF feed';
};

test.asJSON = function(url) {
  subscriptions.request(url, function(xmlDocument, originalContentType) {
    //console.log('The original contentType was "%s"', originalContentType);
    var obj = xml2json.transform(xmlDocument);
    console.dir(obj);

  },function(err) { console.log('error %s',err); }, 5000);
  return 'Fetching ' + url + ' as a normalized JSON object';
};

test.sanitizeString = function(str) {
  var doc = htmlParser.parse(str);
  var rules = contentFiltering.loadRules();
  sanitizer.sanitize(null, doc, rules);
  return doc.innerHTML;
};