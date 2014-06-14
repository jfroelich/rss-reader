
var test = {};

test.applyCalamine = function(url) {
  var req = new XMLHttpRequest();
  req.timeout = 5000;

  req.onerror = function(err) {console.error(err);};
  req.onabort = req.onerror;
  req.ontimeout = req.onerror;
  req.onload = function(event) {
    var doc = this.responseXML;

    // Resolve images
    var baseURI = URI.parse(url);
    util.each(doc.querySelectorAll('img'), function(img) {
      var source = img.getAttribute('src');
      if(source) {
        var relativeSourceURI = URI.parse(source);
        if(relativeSourceURI.scheme) return;
        img.setAttribute('src', URI.resolve(baseURI, relativeSourceURI));
      }
    });

    var options = {
      FILTER_ATTRIBUTES: 1,
      HIGHLIGHT_MAX_ELEMENT: 0,
      SHOW_ANCHOR_DENSITY: 0,
      SHOW_BRANCH: 0,
      SHOW_CARDINALITY: 0,
      SHOW_CHAR_COUNT: 0,
      SHOW_SCORE: 0,
      UNWRAP_UNWRAPPABLES: 0
    };

    calamine.transform(doc, options);
    document.body.innerHTML = doc.body.innerHTML;
  };
  
  req.open('GET', url);
  req.responseType = 'document';
  req.send();
  return 'Applying lotion to ' + url;
};

test.fetchHTML = function(url) {
  var req = new XMLHttpRequest();
  req.timeout = 10000;
  req.onerror = console.error;
  req.onabort = console.error;
  req.ontimeout = console.error;
  req.onload = function(event) {
    var doc = this.responseXML;

    // Minor cleanup
    util.each(doc.querySelectorAll('script'), function(script) {
      script.parentNode.removeChild(script);
    });
    var comments = doc.createNodeIterator(doc.body, NodeFilter.SHOW_COMMENT);
    var comment = null;
    var commentsToRemove = [];
    while(comment = comments.nextNode()) {
      commentsToRemove.push(comment);
    }
    commentsToRemove.forEach(function (comment) {
      comment.parentNode.removeChild(comment);
    });

    var pre = document.createElement('pre');
    pre.textContent = doc.body.innerHTML.replace(/[\r\n]+/gm,'\n').replace(/ +/g,' ');
    pre.setAttribute('id','oldpre');

    var oldpre = document.getElementById('oldpre');
    if(oldpre) oldpre.parentNode.removeChild(oldpre);

    document.body.appendChild(pre);
  };
  req.open('GET', url);
  req.responseType = 'document';
  req.send();
  return 'Fetching HTML for ' + url;
};


test.feedUpdate = function(url) {
  //http://news.google.com/news?pz=1&cf=all&ned=us&hl=en&output=rss
  var uri = URI.parse(url);
  delete uri.scheme;
  var schemeless = URI.toString(uri);
  
  model.connect(function(db) {
    db.transaction('feed').objectStore('feed').index('schemeless').get(schemeless).onsuccess = function(event) {
      var feed = this.result;
      
      var updater = new FeedUpdate();
      updater.fetch = 1;
      updater.notify = 0;
      updater.db = db;
      
      updater.onerror = function(error) {
        console.log(error);
      };
      
      updater.oncomplete = function(feed, processed, added) {
        console.log('Updated %s. Processed %s, added %s', feed.url, processed, added);
      };
      
      updater.update(feed.id, feed.url);
    };
  });
};

test.fhr = function(url) {
  var request = new FeedHttpRequest();

  request.onerror = console.log;
  request.oncomplete = function(feed) {
    console.dir(feed);
  };
  
  request.send(url);
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
  return util.parseHTML(str);
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
  var doc = util.parseHTML(str);
  sanitizer.sanitize(null, doc);
  return doc.innerHTML;
};

test.seed = function(urls) {
  var onComplete = function(f,c){
    console.log('Seeded %s with %s articles', f.url, c);
  };
  
  model.connect(function(db) {
    util.each(urls, function(url) {
      var params = {url:url};
      params.onerror = function(err) {
        console.log('err %s', JSON.stringify(err));
      };
      subscriptions.add(params);
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
  var doc = util.parseHTML(str);
  var nodeHandler = function(node) { app.sanitizer.unwrap(node); };
  util.each(doc.querySelectorAll(tag), nodeHandler);
  return doc.innerHTML;
};

test.escapeHTMLAttribute = function() {
  console.assert(util.escapeHTMLAttribute, 'escapeHTMLAttribute is undefined');
  console.assert(util.escapeHTMLAttribute('"') == '&#34;', 'failed to escape quote');
  console.assert(util.escapeHTMLAttribute('a"bc') == 'a&#34;bc', 'failed to escape quote');
  return 'Running test escapeHTMLAttribute';
};

test.trimHTML = function(html) {
  var doc = util.parseHTML(html);
  trimming.trimDocument(doc);
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