var app = chrome.extension.getBackgroundPage();

var test = {};

test.seed = function(urls) {
  var onComplete = function(f,c){
    console.log('Seeded %s with %s articles', f.url, c);
  };
  
  var rules = app.contentFiltering.loadRules();
  
  app.model.connect(function(db) {
    app.collections.each(urls, function(url) {
      app.feedUpdater.updateFeed(db, {'url': url}, onComplete, 1000, rules);
    });
  });

  return 'Seeding ' + urls.length + ' urls';
};

test.fetch = function(url) {
  app.fetcher.fetch(url, function(xml) {
    console.dir(xml);  
  }, function(e) {
    console.log('fetch test error message: %s', e);
  });
  return 'Fetching ' + url;
};

test.fetchParseURL = function(url) {
  app.fetcher.fetch(url, function(responseXML) {
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
  return doc.body.innerHTML;
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
  console.log(doc.body.innerHTML);
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