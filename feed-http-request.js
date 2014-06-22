/**
 * TODO: response.responseURL i think lets me detect redirects now?
 * i think its final url not start url?
 * TODO: integrate EventTargetMixin
 * TODO: create HTMLHttpRequest and separate out the code from here
 * into there. that should also mixin EventTargetMixin
 * TODO: once EventTargetMixin is fixed then the callers all need
 * to use the new event listener approach
 *
 * TODO: shouldn't this really be just a function? What is really
 * stateful about this from request to request? Are there ever
 * multiple listeners? I may be just overcomplicating the code
 * with all this stuff. In the end it is all just two async callbacks:
 * resolve and reject. resolve is oncomplete and reject is onerror.
 *
 * This should just be requestFeed({url,onload,onerror,timeout}).
 * NOTE: url validation happens when the request is send and funnels
 * into an exception or an XMLHttpRequest error event, I don't need
 * to do it myself.
 * NOTE: online check happens when the request is sent and funnels
 * into an exception or an XMLHttpRequest error event, I don't need
 * to do it myself.
 */

var FeedHttpRequest = function() {};

FeedHttpRequest.prototype.send = function(url) {
  this.url = url ? url.trim() : url;
  this.onerror = this.onerror || util.noop;
  this.oncomplete = this.oncomplete || util.noop;

  if(!URI.isValidString(this.url)) {
    // TODO: dispatch error event
    this.onerror({type:'invalidurl',url: this.url});
    // TODO: dispatch complete event
    return this.oncomplete();
  }

  if(!navigator.onLine) {
    // TODO: dispatch error event
    this.onerror({type:'offline',url: this.url});
    // TODO: dispatch complete event
    return this.oncomplete();
  }

  var request = new XMLHttpRequest();
  request.open('GET', this.url, true);
  request.timeout = this.timeout;

  request.onerror = function(event) {
    // TODO: dispatch error event
    this.onerror({type:'httperror',url:this.url,event:event});
    // TODO: dispatch complete event
    this.oncomplete();
  }.bind(this);

  request.onabort = function(event) {
    // TODO: dispatch error event
    this.onerror({type:'abort',url:this.url});
    // TODO: dispatch complete event
    this.oncomplete();
  }.bind(this);

  request.ontimeout = function(event) {
    // TODO: dispatch error event
    this.onerror({type:'timeout',url:this.url,timeout: event.target.timeout});
    // TODO: dispatch complete event
    this.oncomplete();
  }.bind(this);

  request.onload = this.onFeedLoaded.bind(this);
  request.send();
};

FeedHttpRequest.prototype.onFeedLoaded = function(event) {
  var response = event.target;

  if(200 != response.status) {
    // TODO: dispatch error event
    this.onerror({
      type:'httpstatus',
      url: this.url,
      status:response.status,
      statusText:response.statusText
    });

    // TODO: dispatch complete event
    return this.oncomplete();
  }

  // TODO: would overrideMimeType work?

  var type = response.getResponseHeader('Content-Type') || '';

  if(this.isXMLFeedType(type)) {
    if(!response.responseXML) {
      // TODO: dispatch error event
      this.onerror({type:'responsexmlundefined',url:this.url});
      // TODO: dispatch complete event
      return this.oncomplete();
    }

    if(!response.responseXML.documentElement) {
      // TODO: dispatch error event
      this.onerror({type:'documentelementundefined',url:this.url,
        responseXML:response.responseXML});
      // TODO: dispatch complete event
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

      // TODO: dispatch error event
      this.onerror(exception);
      // TODO: dispatch complete event
      return this.oncomplete();
    }

    if(!xmlDocument.documentElement) {

      // TODO: dispatch error event

      this.onerror({type:'documentelementundefined',url:this.url,
        responseXML:xmlDocument});

      // TODO: dispatch complete event

      return this.oncomplete();
    }

    return this.parseXMLFeed(xmlDocument);
  }

  // Not xml, not html, so just report a fatal error.
  // self.dispatchEvent({type:'error',subtype:'contenttype',url:this.url,contentType:type});
  this.onerror({type:'contenttype',url:this.url,contentType:type});
  // self.dispatchEvent({type:'complete'});
  this.oncomplete();
};

FeedHttpRequest.prototype.isXMLFeedType = function(typeString) {
  return /(application|text)\/(atom|rdf|rss)?\+?xml/i.test(typeString);
};

FeedHttpRequest.prototype.isTextPlainOrTextHTML = function(typeString) {
  return /text\/(plain|html)/i.test(typeString);
};

FeedHttpRequest.prototype.entryHasDefinedLink = function(entry) {
  return entry.link;
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

    // self.dispatchEvent({type:'error',subtype:'parse',exception:exception});

    self.onerror(exception);

    // self.dispatchEvent({type:'complete'});

    return self.oncomplete();
  }

  if(!feed.entries.length) {

    // TODO: dispatch complete event instead

    return this.oncomplete(feed);
  }

  // This is partly wrong. forEach accepts a thisArg parameter.
  // So instead of binding the function here, we just pass 'this'
  // to forEach

  var rewrite = function(entry) {
    entry.originalLink = entry.link;
    entry.link = this.rewriteURL(entry.link);
  }.bind(this);

  if(localStorage.URL_REWRITING_ENABLED) {
    feed.entries.filter(this.entryHasDefinedLink).forEach(rewrite);
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
      throw new Error('Cannot fetch entry with undefined/empty link property');
    }

    var request = new XMLHttpRequest();
    request.open('GET', entry.link, true);
    request.timeout = self.timeout;

    request.onerror = function(event) {
      console.log('http error fetching %s', entry.link);

      // self.dispatchEvent({type:'error',url:entry.link});

      self.onerror({type:'httperror',url:entry.link});

      entryProcessComplete();
    };

    request.onabort = function(event) {
      console.log('http abort error fetching %s', entry.link);

      // self.dispatchEvent({type:'error',subtype:'abort',url:entry.link});

      self.onerror({type:'abort', url: entry.link});
      entryProcessComplete();
    };

    request.ontimeout = function(event) {
      console.log('http timeout error fetching %s', entry.link);

      // self.dispatchEvent({type:'error',subtype:'timeout',url:entry.link,timeout:self.timeout});

      self.onerror({type:'timeout',url: entry.link});
      entryProcessComplete();
    };

    request.onload = function(event) {
      var response = event.target;

      var doc = response.responseXML;
      var type = response.getResponseHeader('content-type');

      if(/text\/html/i.test(type) && response.responseXML && response.responseXML.body) {
        entry.content = response.responseXML.body.innerHTML;
      } else {
        entry.content = 'Unsupported content type. The webpage at ' + response.responseURL +
          ' does not appear to be a normal webpage.';
      }

      entryProcessComplete();
    };
    // Prefer HTML
    request.responseType = 'document';
    try {
      request.send();
    } catch(e) {
      // TODO: does this even throw an exception?
      // TODO: broadcast error here?
      console.dir(e);
    }
  };

  var entriesProcessed = 0;

  var entryProcessComplete = function() {
    if(++entriesProcessed == feed.entries.length) {

      // self.dispatchEvent({type:'complete',feed:feed});

      self.oncomplete(feed);
    }
  };
};

FeedHttpRequest.prototype.findEntryByLinkURL = function(db, url, callback) {
  db.transaction('entry').objectStore('entry').index('link').get(url).onsuccess = function(event) {
    callback(event.target.result);
  };
};

/*
TODO: this really does not belong here.
TODO: base this on an API similar to mod_rewrite in Apache.
*/

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

// EventTargetMixin.call(FeedHttpRequest.prototype);