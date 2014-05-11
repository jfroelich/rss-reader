var app = chrome.extension.getBackgroundPage();

var test = {};

test.seed = function(urls) {
  var onComplete = function(f,c){
    console.log('Seeded %s with %s articles', f.url, c);
  };
  
  app.model.connect(function(db) {
    app.each(urls, function(url) {
      app.updateFeed(db, {'url': url}, onComplete, 1000);
    });
  });

  return 'Seeding ' + urls.length + ' urls';
};

test.fetch = function(url) {
  app.fetchFeed(url, function(xml) {
    console.dir(xml);  
  }, function(e) {
    console.log('fetch test error message: %s', e);
  });
  return 'Fetching ' + url;
};

test.fetchParseURL = function(url) {
  app.fetchFeed(url, function(responseXML) {
    var feed = app.parseFeedXML(responseXML);
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
  var doc = app.parseHTML(str);
  var nodeHandler = function(node) { app.unwrap(node); };
  app.each(doc.querySelectorAll(tag), nodeHandler);
  return doc.innerHTML;
};

test.escapeHTMLAttribute = function() {
  console.assert(app.escapeHTMLAttribute, 'app.escapeHTMLAttribute is undefined');
  console.assert(app.escapeHTMLAttribute('"') == '&#34;', 'failed to escape quote');
  console.assert(app.escapeHTMLAttribute('a"bc') == 'a&#34;bc', 'failed to escape quote');
  return 'Running test escapeHTMLAttribute';
};

test.trimHTML = function(html) {
  var doc = app.parseHTML(html);
  app.trimDocument(doc);
  console.log(doc.body.innerHTML);
  return 'Testing HTML trim';
};

test.fade = function(id) {
  fade(document.getElementById(id), 2, 1, function(){
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
