var app = chrome.extension.getBackgroundPage();

var test = {};

test.updateFeed = function(url) {
  //http://news.google.com/news?pz=1&cf=all&ned=us&hl=en&output=rss
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

test.seed = function(urls) {
  var onComplete = function(f,c){
    console.log('Seeded %s with %s articles', f.url, c);
  };
  
  var rules = app.contentFiltering.loadRules();
  
  app.model.connect(function(db) {
    app.collections.each(urls, function(url) {
      var params = {url:url};
      params.onerror = function(err) {
        console.log('err %s', JSON.stringify(err));
      };
      app.subscriptions.add(params);
    });
  });

  return 'Seeding ' + urls.length + ' urls';
};

/*
test.fetch = function(url) {
  subscriptions.request(url, function(xml, originalContentType){
    console.dir(xml);
  }, function(event){
    console.log('Error %s', event);
  }, 5000);
  return 'Fetching ' + url;
};*/


test.fetch = function(url) {
  app.subscriptions.request(url, function(xml) {
    console.dir(xml);  
  }, function(e) {
    console.log('fetch test error message: %s', e);
  });
  return 'Fetching ' + url;
};

test.fetchParseURL = function(url) {
  app.subscriptions.request(url, function(responseXML) {
    var feed = app.xml2json.transform(responseXML);
    if(feed.error) {
      console.log('Error %s',feed.error);
      return;
    }

    console.dir(feed);
  }, 5000);
  return 'Fetching and parsing ' + url;
};

test.clearDB = function() {
  app.model.connect(function(db) {
    var tx = db.transaction(['feed','entry'],'readwrite');
    tx.objectStore('entry').clear();
    tx.objectStore('feed').clear();
    tx.oncomplete = function() { console.log('Cleared database'); };
  });

  return 'Clearing database';
};

test.unwrap = function(str, tag) {
  var doc = app.htmlParser.parse(str);
  var nodeHandler = function(node) { app.sanitizer.unwrap(node); };
  app.collections.each(doc.querySelectorAll(tag), nodeHandler);
  return doc.innerHTML;
};

test.escapeHTMLAttribute = function() {
  console.assert(app.strings.escapeHTMLAttribute, 'app.escapeHTMLAttribute is undefined');
  console.assert(app.strings.escapeHTMLAttribute('"') == '&#34;', 'failed to escape quote');
  console.assert(app.strings.escapeHTMLAttribute('a"bc') == 'a&#34;bc', 'failed to escape quote');
  return 'Running test escapeHTMLAttribute';
};

test.trimHTML = function(html) {
  var doc = app.htmlParser.parse(html);
  app.trimming.trimDocument(doc);
  console.log(doc.innerHTML);
  return 'Testing HTML trim';
};

test.fade = function(id) {
  fx.fade(document.getElementById(id), 2, 1, function(){
    console.log('toggle completed');
  });
  return 'Toggling ' + id;
};

test.testOnTimeout = function(timeout) {
  var r = new XMLHttpRequest();
  r.timeout = timeout;
  r.ontimeout = function(event) {
    console.log('timed out!');
  };
  r.onload = function() {
    console.log('onload reached');
  };
  r.open('GET', 'http://www.google.com', true);
  r.send();
};

test.detectRedirect = function(url) {
  var request = new XMLHttpRequest();
  request.onabort = console.log;
  request.ontimeout = console.log;
  request.onerror = console.log;
  request.onload = function(event) {   
    var headers = event.target.getAllResponseHeaders();
    console.log(headers);
    console.log('Location: %s', event.target.getResponseHeader('location'));
  };
  
  request.open('HEAD', url, true);
  request.send();
  return 'Checking ' + url;
};