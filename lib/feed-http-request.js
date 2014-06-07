
var FeedHttpRequest = function() {};

FeedHttpRequest.prototype.send = function(url) {
  this.url = url ? url.trim() : url;
  this.onerror = this.onerror || util.noop;
  this.oncomplete = this.oncomplete || util.noop;

  if(!URI.isValidString(this.url)) {
    this.onerror({type:'invalidurl',url: this.url});
    return this.oncomplete();
  }

  if(!navigator.onLine) {
    this.onerror({type:'offline',url: this.url});
    return this.oncomplete();
  }

  var request = new XMLHttpRequest();
  request.open('GET', this.url, true);
  request.timeout = this.timeout;

  request.onerror = function(event) {
    this.onerror({type:'httperror',url:this.url,event:event});
    this.oncomplete();
  }.bind(this);
  
  request.onabort = function(event) {
    this.onerror({type:'abort',url:this.url});
    this.oncomplete();
  }.bind(this);
  
  request.ontimeout = function(event) {
    this.onerror({type:'timeout',url:this.url,timeout: event.target.timeout});
    this.oncomplete();
  }.bind(this);

  request.onload = this.onFeedLoaded.bind(this);
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

  // TODO: would overrideMimeType work?

  var type = response.getResponseHeader('Content-Type') || '';

  if(this.isXMLFeedType(type)) {
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
  if(this.isTextPlainOrTextHTML(type)) {
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
  
  //console.log('parseXMLFeed %s', this.url);
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
      if(!entry.link) {
        return entryProcessComplete();
      }

      self.findEntryByLinkURL(db, entry.link, function(existingEntry) {
        if(existingEntry) {
          entryProcessComplete();
        } else {
          fetchEntry(entry);
        }
      });
    });
  });

  var fetchEntry = function(entry) {
    
    if(!entry.link) {
      throw new Error('Cannot fetch entry with undefined link');
    }
    
    var request = new XMLHttpRequest();
    request.open('GET', entry.link, true);
    request.timeout = self.timeout;
    
    request.onerror = function(event) {
      self.onerror({type:'httperror',url:entry.link});
      entryProcessComplete();
    };
    
    request.onabort = function(event) {
      self.onerror({type:'abort', url: entry.link});
      entryProcessComplete();
    };

    request.ontimeout = function(event) {
      self.onerror({type:'timeout',url: entry.link});
      entryProcessComplete();
    };
    
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

  var entriesProcessed = 0;

  var entryProcessComplete = function() {
    if(++entriesProcessed == feed.entries.length) {
      //console.log('All entries processed for %s', self.url);
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
  // sanitizer may also do rewriting of links inside content?

  var reGoogleNews = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  var matches = reGoogleNews.exec(url);
  if(matches && matches.length == 2 && matches[1]) {
    var newURL = window.decodeURIComponent(matches[1]);
    //console.log('Rewriting %s as %s', url, newURL);
    return newURL;
  }

  return url;
};