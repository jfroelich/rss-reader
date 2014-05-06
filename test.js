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

test.fetchParseURL = function(url) {
  app.fetchFeed(url, function(responseXML) {
    var feed = app.feedParser.parseXML(responseXML);
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

test.trim = function() {
  var html = '<br>\n<br><p><br><br>\nTest\n<br>\n'+
    '</p>prelinebreak\n<br><!-- howdy--><br>\n<br>\n<br>';
  var doc = app.parseHTML(html);
  app.trimDocument(doc);
  console.log(doc.body.innerHTML);
};