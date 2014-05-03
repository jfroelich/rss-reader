var app = chrome.extension.getBackgroundPage();


var test = {};

test.seed = function() {
  var urls = [];

  var onComplete = function(f,c){
    console.log('Seeded %s with %s articles', f.url, c);
  };
  
  app.model.connect(function(db) {
    app.each(urls, function(url) {
      app.feedUpdater.update(db, {'url': url}, onComplete, 1000);
    });
  });

  return 'Seeding ' + urls.length + ' urls';
};

test.parse = function(url) {
  var onFetch = function(feed) {
    if(feed.error) {
      console.log('Error %s',feed.error);
      return;
    }

    console.dir(feed);
  };

  app.fetchFeed(url, onFetch, 5000);
  return 'Parsing ' + url;
};

test.rawXML = function(url) {
  var r = new XMLHttpRequest();
  r.open('GET', url, true);
  r.responseType='document';
  r.onerror = function(e) { console.dir(this); };
  r.onload = function(e) { console.log(this.responseXML); };
  r.send();
  return 'Fetching ' + url;
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
  app.legacyEach(doc.querySelectorAll(tag), nodeHandler);
  return doc.innerHTML;
};