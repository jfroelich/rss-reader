
// TODO: consider extending an event listener, something like EventTarget in 
// Google Closure. Map onerror and oncomplete to it and dispatch events 
// through it.

// TODO: should url be a parameter to fetch instead of to constructor?

var FeedHttpRequest = function() {};

FeedHttpRequest.prototype.send = function(url) {
  this.url = url ? url.trim() : '';
  this.onerror = this.onerror || util.noop;
  this.oncomplete = this.oncomplete || util.noop;

  if(!URI.isValidString(this.url)) {
    this.onerror({type:'invalidurl',url: this.url});
    return this.oncomplete();
  }

  // Verify we are online
  // TODO: refactor the online checks in subscriptions.js considering 
  // that we do the check here instead.
  // NOTE: all this really does is differentiate between 404 error 
  // that occurs when sending XMLHttpRequest and being offline. 
  // But it does  also reduce the amount of times XMLHttpRequest errors
  // appear in the console, which according to Google cannot be 
  // prevented (forgot the url for this).

  if(!navigator.onLine) {
    this.onerror({type:'offline',url: this.url});
    return this.oncomplete();
  }

  var request = new XMLHttpRequest();
  request.open('GET', this.url, true);
  request.timeout = this.timeout;

  var onFetchError = function(event) {
    this.onerror(event);
    this.oncomplete();
  }.bind(this);

  request.onerror = onFetchError;
  request.onabort = onFetchError;
  request.ontimeout = onFetchError;
  request.onload = this.onFeedLoaded.bind(this);

  // NOTE: because we want to support the fallback to 
  // text/html handling for feed files sent back with the wrong mime 
  // type, we cannot use request.responseType here, for a few reasons. 
  // One reason is that Chrome denies access to response.responseText for 
  // certain response types. I have no idea why.
  // Another reason is that the XML parser fails, silently, when trying to 
  // parse HTML (non XHTML) as XML.

  // TODO: think abit more about overrideMimeType and how it would work 
  // for example, we could override html and plaintext, but what about 
  // other content types. Also, won't html have the same issues i ran 
  // into with trying to use the built in parser? but why does parsing 
  // it non-natively using parseXML work? Doesn't util.parseXML just 
  // use DOMParser?

  request.send();

};

FeedHttpRequest.prototype.onFeedLoaded = function(event) {

  var response = event.target;

  if(200 != response.status) {
    this.onerror({
      type:'httpstatus',
      url: this.url,
      status:response.status,
      statusText:response.statusText
    });

    return this.oncomplete();
  }

  var type = response.getResponseHeader('Content-Type') || '';

  if(this.isXMLFeedType(type)) {
    // Chrome parses the response and sets responseXML for us, even 
    // if we did not set responseType.

    if(!response.responseXML) {
      this.onerror({type:'responsexmlundefined',url:this.url});
      return this.oncomplete();
    }

    if(!response.responseXML.documentElement) {
      this.onerror({type:'documentelementundefined',url:this.url,
        responseXML:response.responseXML});
      return this.oncomplete();
    }

    // We got valid XML, handoff the xml to parseFeed
    return this.parseXMLFeed(response.responseXML);
  }

  // Fallback to handling text/plain and text/html
  if(this.isTextPlainOrTextHTML(contentType)) {
    var xmlDocument = null;
    try {
      xmlDocument = util.parseXML(response.responseText);
    } catch(exception) {
      this.onerror(exception);
      return this.oncomplete();
    }

    if(!xmlDocument.documentElement) {
      this.onerror({type:'documentelementundefined',url:this.url,
        responseXML:xmlDocument});
      return this.oncomplete();
    }

    return this.parseXMLFeed(xmlDocument);
  }

  // Not xml, not html, so just report a fatal error.
  this.onerror({type:'contenttype',url:this.url,contentType:type});
  this.oncomplete();
};

FeedHttpRequest.prototype.isXMLFeedType = function(typeString) {
  return /(application|text)\/(atom|rdf|rss)?\+?xml/i.test(typeString);
};

FeedHttpRequest.prototype.isTextPlainOrTextHTML = function(typeString) {
  return /text\/(plain|html)/i.test(typeString);
};

FeedHttpRequest.prototype.parseXMLFeed = function(xmlDocument) {
  var self = this;
  // Parse the XML into a feed object.
  var feed = null;
  try {
    feed = xml2json.transform(xmlDocument);
  } catch(exception) {
    // A parsing error on the main feed object is a stopper
    self.onerror(exception);
    return self.oncomplete();
  }

  if(!feed.entries.length) {
    return this.oncomplete(feed);
  }

  var isLinkDefined = function(entry) {
    return entry.link;
  };

  var rewrite = function(entry) {
    entry.originalLink = entry.link;
    entry.link = this.rewriteURL(entry.link);
  }.bind(this);

  if(localStorage.URL_REWRITING_ENABLED) {
    feed.entries.filter(isLinkDefined).forEach(rewrite);
  }

  model.connect(function(db) {
    feed.entries.forEach(function(entry) {
      self.findEntryByLinkURL(db, entry.link, function(existingEntry) {
        if(existingEntry) {
          // console.log('url %s already exists, not downloading again', entry.link);
          entryProcessComplete();
        } else {
          // console.log('url %s does not exist in db', entry.link);
          fetchEntry(entry);
        }
      });
    });
  });

  var fetchEntry = function(entry) {
    var request = new XMLHttpRequest();
    request.open('GET', entry.link, true);
    request.timeout = self.timeout;
    request.onerror = onFetchError;
    request.onabort = onFetchError;
    request.ontimeout = onFetchError;
    request.onload = function(event) {
      var response = event.target;
      
      // TODO: validate content type is text/plain or text/html

      if(response.responseText) {
        entry.content = response.responseText;  
      }
      
      entryProcessComplete();
    };
    
    request.send();    
  };

  var onFetchError = function(event) {
    self.onerror(event);
    entryProcessComplete();
  };

  var entriesProcessed = 0;

  var entryProcessComplete = function() {
    if(++entriesProcessed == feed.entries.length) {
      //console.log('all entries processed');
      self.oncomplete(feed);
    }
  };
};

FeedHttpRequest.prototype.findEntryByLinkURL = function(db, url, callback) {
  db.transaction('entry').objectStore('entry').index('link').get(url).onsuccess = function(event) {
    callback(event.target.result);
  };
};

FeedHttpRequest.prototype.rewriteURL = function(url) {
  
  // TODO: research additional feeds that use URL proxies.
  // TODO: move logic into a separate class since 
  // sanitizer may also do rewriting.

  var reGoogleNews = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  var matches = reGoogleNews.exec(url);
  if(matches.length == 2 && matches[1]) {
    var newURL = window.decodeURIComponent(matches[1]);
    //console.log('Rewriting %s as %s', url, newURL);
    return newURL;
  }

  return url;
};