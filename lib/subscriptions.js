/**
 * Subscriptions module
 *
 * TODO: test import, subscribe offline, update 
 */
var subscriptions = {};

/**
 * @param params - holder of properties:
 * url,db,fetch,notify,onerror,timeout,cfrules
 */
subscriptions.add = function(params) {

  var url = util.stripControls((params.url || '').trim());
  var db = params.db;
  var fetch = params.fetch;
  var notify = params.notify;
  var onerror = params.onerror;
  var timeout = params.timeout;
  var oncomplete = params.oncomplete;

  if(!oncomplete) {
    console.error('oncomplete undefined in add');
    return;
  }

  onerror = onerror || function(err) {
    console.log('Error: %s', err);
  };

  if(!URI.isValidString(url)) {
    return onerror({type:'invalidurl',url:url});
  }

  var advanceIfNotSubscribed = function(db) {
    var schemeless = subscriptions.getSchemelessURL(url);
    subscriptions.isSubscribed(url, function(exists) {
      if(exists) {
        onerror({type:'exists',url:url});
      } else {
        var feedId = 0;
        subscriptions.fetch(url,feedId,fetch,notify,oncomplete,onerror,timeout);
      }
    });
  };

  if(db) {
    advanceIfNotSubscribed(db);
  } else {
    model.connect(function(db) {
      advanceIfNotSubscribed(db);
    });  
  }
};

subscriptions.update = function(params) {

  var feedId = params.feedId;
  var url = params.url;
  var db = params.db;
  var fetch = params.fetch;
  var notify = params.notify;
  var onerror = params.onerror|| function(e) { console.log(e); };
  var timeout = params.timeout;
  var oncomplete = params.oncomplete;
  subscriptions.fetch(url,feedId,fetch,notify,oncomplete,onerror,timeout);
};

subscriptions.remove = function(feedId) {
  console.log('remove %s', feedId);
  model.connect(function(db) {
    var tx = db.transaction(['entry','feed'],'readwrite');
    tx.objectStore('feed').delete(feedId);
    tx.oncomplete = function(event) {
      console.log('removed %s, %s entries', feedId, counter);
      chrome.runtime.sendMessage({type:'unsubscribe',feed:feedId,entriesDeleted:counter});
    };

    var counter = 0;
    var entries = tx.objectStore('entry');
    var keys = entries.index('feed').openKeyCursor(IDBKeyRange.only(feedId));
    keys.onsuccess = function(event) {
      if(this.result) {
        entries.delete(this.result.primaryKey);
        counter++;
        this.result.continue();
      }
    };
  });
};

subscriptions.request = function(url, onsuccess, onerror, timeout) {
  var request = new XMLHttpRequest();
  request.timeout = timeout;
  onerror = onerror || function() {};
  request.onerror = function(event) { onerror({type:'requestunknown', url:url}); };
  request.onabort = function(event) { onerror({type:'requestabort', url:url}); };
  request.ontimeout = function(event) { onerror({type:'requesttimeout',url:url,timeout:this.timeout}); };

  request.onload = function(event) {
    if(200 != this.status) {
      onerror({type:'requeststatus',url:url,status:this.status,statusText:this.statusText});
      return;
    }

    var contentType = this.getResponseHeader('Content-Type') || '';
    if(/(application|text)\/(atom|rdf|rss)?\+?xml/i.test(contentType)) {
      if(!this.responseXML) {
        onerror({type:'requestxml',url:url});
        return;
      }

      if(!this.responseXML.documentElement) {
        onerror({type:'requestxmlelement',url:url});
        return;
      }

      onsuccess(this.responseXML, contentType);
      return;
    }

    if(/text\/(plain|html)/i.test(contentType)) {
      try {
        onsuccess(util.parseXML(this.responseText), contentType);
      } catch(error) {
        onerror({type:'requestparse',url:url,contentType: contentType,error:error});
      }

      return;
    }

    onerror({type:'requesttype',url:url,contentType:contentType});
  };

  request.open('GET', url, true);
  request.send();  
};

subscriptions.requestPreview = function(url,onsuccess,onerror,timeout) {

  var onRequest = function(xml,mime) {
    try {
      var feed = xml2json.transform(xml);
    } catch(error) {
      return onerror(error);
    }
    
    var result = {};
    result.url = url;
    if(feed.title) {
      feed.title = feed.title.trim();
      feed.title = util.stripControls(feed.title);
      feed.title = util.stripTags(feed.title);
      if(feed.title) {
        result.title = feed.title;
      }
    }
    
    result.entries = [];    
    feed.entries.forEach(function(entry) {
      var resultEntry = {};
      if(entry.title) {
        entry.title = entry.title.trim();
        entry.title = util.stripControls(entry.title);
        entry.title = util.stripTags(entry.title);
        resultEntry.title = entry.title;
      }

      if(!resultEntry.title) return;
      if(entry.content) {
        var doc = util.parseHTML(entry.content);
        sanitizer.sanitize(null, doc);
        trimming.trimDocument(doc);
        resultEntry.content = doc.textContent.substring(200);
      }
      result.entries.push(resultEntry);
    });
    
    onsuccess(result);
    
    
  };
  
  subscriptions.request(url, onRequest, onerror, timeout);
};

subscriptions.isSubscribed = function(url, callback) {
  model.connect(function(db) {
    db.transaction('feed').objectStore('feed').index('schemeless').get(
      subscriptions.getSchemelessURL(url)).onsuccess = function(event) {
      callback(event.target.result ? 1 : 0);
    };    
  });
};

subscriptions.getSchemelessURL = function(url) {
  var schemeless = URI.parse(url);
  if(schemeless) {
    delete schemeless.scheme;
    return URI.toString(schemeless);
  }
};

subscriptions.fetch = function(url,feedId,fetch,notify,oncomplete,onerror,timeout) {
  if(fetch && navigator.onLine) {
    return subscriptions.request(url, function(xml, mime) {
      subscriptions.parseXML(url,feedId,xml,mime,notify,oncomplete,onerror);
    }, onerror, timeout);
  }

  if(feedId) {
    subscriptions.oncomplete({id:0,url:url},oncomplete,notify,0,0);
  } else {
    model.connect(function(db) {
      subscriptions.insertFeed(db,{url:url},notify,oncomplete,onerror);  
    });
  }
};

subscriptions.parseXML = function(url,feedId,xml,mime,notify,oncomplete,onerror) {
  var fetchedFeed = null;
  try {
    fetchedFeed = xml2json.transform(xml);
  } catch(error) {
    console.log('parse exception %s', error);
    onerror({type:'parse',url:url,error:error});
    return;
  }

  if(feedId) fetchedFeed.id = feedId;
  fetchedFeed.url = url;
  fetchedFeed.fetched = new Date().getTime();
  model.connect(function(db) {
    feedId ? subscriptions.updateFeed(db,fetchedFeed,notify,oncomplete,onerror) :
      subscriptions.insertFeed(db,fetchedFeed,notify,oncomplete,onerror);
  });
};

subscriptions.insertFeed = function(db,fetchedFeed,notify,oncomplete,onerror) {
  console.log('Inserting feed %s', fetchedFeed.url);
  var storableFeed = subscriptions.getStorableFeed(fetchedFeed);
  storableFeed.created = new Date().getTime();
  db.transaction('feed','readwrite').objectStore('feed').add(storableFeed).onsuccess = function(event){
    console.log('Inserted feed, new id %s', this.result);
    storableFeed.id = this.result;
    if(fetchedFeed) {
      subscriptions.addEntries(db,storableFeed,fetchedFeed,notify,oncomplete,onerror,true);
    } else {
      subscriptions.oncomplete(storableFeed,oncomplete,notify,0,0,true);
    }
  };
};

subscriptions.updateFeed = function(db,fetchedFeed,notify,oncomplete,onerror) {
  var storableFeed = subscriptions.getStorableFeed(fetchedFeed);
  var feedStore = db.transaction('feed','readwrite').objectStore('feed');
  var getRequest = feedStore.get(storableFeed.id);
  getRequest.onerror = function(error) {
    onerror({type:'dbrequestgetfeed',feedId:storableFeed.id,error:error});
  };

  getRequest.onsuccess = function(event) {
    var existingFeed = this.result;
    if(!existingFeed) return onerror({type : 'dbfeednotfound' , 'feedId' : storableFeed.id});
    if(storableFeed.title) existingFeed.title = storableFeed.title;
    if(storableFeed.description) existingFeed.description = storableFeed.description;
    if(storableFeed.date) existingFeed.date = storableFeed.date;
    if(storableFeed.link) existingFeed.link = storableFeed.link;
    existingFeed.updated = new Date().getTime();
    if(storableFeed.fetched) existingFeed.fetched = storableFeed.fetched;  
    if(!existingFeed.created) existingFeed.created = existingFeed.updated;
    var putRequest = feedStore.put(existingFeed);
    putRequest.onerror = function(err) {
      onerror({type:'dbputfeed',feed:existingFeed});
    };
    putRequest.onsuccess = function(event) {
      subscriptions.addEntries(db,existingFeed,fetchedFeed,notify,oncomplete,onerror,false);
    };
  };
};

subscriptions.addEntries = function(db,storedFeed,fetchedFeed,notify,oncomplete,onerror,isNewSubscription) {
  if(!fetchedFeed.entries || !fetchedFeed.entries.length) {
    return subscriptions.oncomplete(storedFeed, oncomplete,notify,0,0);
  }
  
  var entriesProcessed = 0, entriesAdded = 0;
  var onUpdateComplete = function() {
    entriesProcessed++;
    if(entriesProcessed >= fetchedFeed.entries.length) {
      subscriptions.oncomplete(storedFeed,oncomplete,notify,entriesProcessed,entriesAdded,isNewSubscription);
    }
  };  
  var onUpdateSuccess = function() {
    entriesAdded++;
    onUpdateComplete();
  };
  var onUpdateError = function() {
    onUpdateComplete();
  };
  util.each(fetchedFeed.entries, function(fetchedEntry) {
    var storableEntry = {};
    storableEntry.hash = subscriptions.generateEntryHash(fetchedEntry);
    if(!storableEntry.hash) {
      onUpdateError();
      return;
    }
    
    var entryStore = db.transaction('entry','readwrite').objectStore('entry');
    var getHashRequest = entryStore.index('hash').get(IDBKeyRange.only(storableEntry.hash));
    getHashRequest.onerror = function(error) {
      onerror({type:'dbgethash',entry:fetchedEntry,error:error});
    };
    getHashRequest.onsuccess = function(event) {
      if(this.result) return onUpdateError();
      if(storedFeed.link) storableEntry.feedLink = storedFeed.link;
      if(storedFeed.title) storableEntry.feedTitle = storedFeed.title;
      storableEntry.feed = storedFeed.id;
      storableEntry.unread = model.UNREAD;
      if(fetchedEntry.author) storableEntry.author = fetchedEntry.author;
      if(fetchedEntry.link) storableEntry.link = fetchedEntry.link;
      if(fetchedEntry.title) storableEntry.title = fetchedEntry.title;
      var pubdate = util.parseDate(fetchedEntry.pubdate);
      if(pubdate) storableEntry.pubdate = pubdate.getTime();
      else if(storedFeed.date) storableEntry.pubdate = storedFeed.date;
      storableEntry.created = new Date().getTime();
      if(fetchedEntry.content) {
        storableEntry.content = subscriptions.prepareEntryContent(
          fetchedEntry.content, storableEntry.feedLink);
      }

      var insertRequest = entryStore.add(storableEntry);
      insertRequest.onerror = onUpdateError;
      insertRequest.onsuccess = onUpdateSuccess;
      
    };

  });
};

subscriptions.prepareEntryContent = function(text, baseURL) {
  var doc = util.parseHTML(text);
  sanitizer.sanitize(baseURL, doc);
  trimming.trimDocument(doc);
  return doc.innerHTML;
};

subscriptions.oncomplete = function(feed,oncomplete,notify,entriesProcessed,entriesAdded,isNewSubscription) {
  if(isNewSubscription) chrome.runtime.sendMessage({type:'subscribe',feed:feed});
  if(notify) util.notify('Subscribed to '+feed.title+'. Found '+entriesAdded+' new articles.');
  oncomplete(feed, entriesProcessed, entriesAdded);
};

subscriptions.generateEntryHash = function(entry) {
  var seed = entry.link || entry.title || entry.content;
  if(seed) return util.generateHashCode(seed.split(''));
};

subscriptions.getStorableFeed = function(input) {
  var output = {};
  if(input.id) output.id = input.id;
  output.url = input.url;
  output.schemeless = subscriptions.getSchemelessURL(input.url);

  if(input.title) {
    output.title = util.stripTags(util.stripControls(input.title));
  } else {
    //output.title = 'Untitled';
    output.title = util.stripTags(util.stripControls(input.url));
  }

  if(input.description) {
    output.description = util.stripTags(util.stripControls(input.description));
  }

  if(input.link) {
    output.link = util.stripControls(input.link);
  }

  if(input.date) {
    var d = util.parseDate(util.stripControls(input.date));
    if(d) output.date = d.getTime();  
  }

  if(input.fetched) output.fetched = input.fetched; 
  if(input.created) output.created = input.created;  
  if(input.updated) output.updated = input.updated;
  return output;
};