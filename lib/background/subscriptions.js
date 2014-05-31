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

  var url = strings.stripControls((params.url || '').trim());
  var db = params.db;
  var fetch = params.fetch;
  var notify = params.notify;
  var onerror = params.onerror;
  var timeout = params.timeout;
  var cfrules = params.cfrules || contentFiltering.loadRules();
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
        subscriptions.fetch(url,feedId,fetch,notify,oncomplete,onerror,timeout,cfrules);
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
  var onerror = params.onerror;
  var timeout = params.timeout;
  var cfrules = params.cfrules;
  var oncomplete = params.oncomplete;

  //console.log('Updating %s', url);

  onerror = onerror || function(err) {
    console.log('Error: %s', err);
  };

  cfrules = cfrules || contentFiltering.loadRules();

  subscriptions.fetch(url,feedId,fetch,notify,oncomplete,onerror,timeout,cfrules);
};

subscriptions.remove = function(feedId) {
  console.log('remove %s', feedId);
  model.connect(function(db) {
    var tx = db.transaction(['entry','feed'],'readwrite');
    tx.objectStore('feed').delete(feedId);
    tx.oncomplete = function(event) {
      console.log('removed %s, %s entries', feedId, counter);
      extension.sendMessage({type:'unsubscribe',feed:feedId,entriesDeleted:counter});
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
  //console.log('request %s', url);

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  onerror = onerror || function() {};
  request.onerror = function(event) { onerror({type:'requestunknown', url:url}); };
  request.onabort = function(event) { onerror({type:'requestabort', url:url}); };
  request.ontimeout = function(event) { onerror({type:'requesttimeout',url:url,timeout:this.timeout}); };

  request.onload = function(event) {
    //console.log('onload %s %s %s', url, this.status, this.statusText);

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

    // Fallback attempt at handling incorrect mime type
    if(/text\/(plain|html)/i.test(contentType)) {
      try {
        // TODO: pass along charset to parseFromString
        var xmlDocument = xml.parseFromString(this.responseText);
        onsuccess(xmlDocument, contentType);
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
    
    var feed = null;
    
    try {
      feed = xml2json.transform(xml);
    } catch(error) {
      console.log('parsing error when fetching preview');
      onerror(error);
      return;
    }
    
    var result = {};
    
    result.url = url;
    if(feed.title) {
      feed.title = feed.title.trim();
      feed.title = strings.stripControls(feed.title);
      feed.title = strings.stripTags(feed.title);
      if(feed.title) {
        result.title = feed.title;
      }
    }
    
    result.entries = [];
    
    var cfrules = contentFiltering.loadRules();
    
    feed.entries.forEach(function(entry) {
      var resultEntry = {};
      if(entry.title) {
        entry.title = entry.title.trim();
        entry.title = strings.stripControls(entry.title);
        entry.title = strings.stripTags(entry.title);
        resultEntry.title = entry.title;
      }

      if(!resultEntry.title) {
        return;
      }
      
      if(entry.content) {
        var doc = htmlParser.parse(entry.content);
        sanitizer.sanitize(null, doc, cfrules);
        trimming.trimDocument(doc);
        
        // Note: the problem with textContent is that 
        // it does not insert whitespace in for the tags 
        // so words in the output text appear without 
        // delimiting whitespace.
        
        // So this needs to 
        
        resultEntry.content = doc.textContent.substring(200);
      }
      result.entries.push(resultEntry);
    });
    
    onsuccess(result);
    
    
  };
  
  subscriptions.request(url, onRequest, onerror, timeout);
};

subscriptions.isSubscribed = function(url, callback) {
  var schemeless = subscriptions.getSchemelessURL(url);
  model.connect(function(db) {
    db.transaction('feed').objectStore('feed').index('schemeless').get(schemeless).onsuccess = function(event) {
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

/**
 * If supposed to fetch and online, then fetch. Otherwise
 * skip ahead to insert/update.
 */
subscriptions.fetch = function(url,feedId,fetch,notify,oncomplete,onerror,timeout,cfrules) {
  if(!oncomplete) {
    console.error('oncomplete undefined in fetch');
    return;
  }
  //console.log('fetch url %s, online %s, fetch %s', url, navigator.onLine, fetch);

  if(fetch && navigator.onLine) {
    return subscriptions.request(url, function(xml, mime) {
      subscriptions.parseXML(url,feedId,xml,mime,notify,oncomplete,onerror,cfrules);
    }, onerror, timeout);
  }

  if(feedId) {
    console.log('Cannot update %s while offline or fetch flag not true', feedId);
    subscriptions.oncomplete({id:0,url:url},oncomplete,notify,0,0);
  } else {
    //console.log('Subscribing to %s while offline or fetch flag not true', url);  
    model.connect(function(db) {
      subscriptions.insertFeed(db,{url:url},notify,oncomplete,onerror,cfrules);  
    });
  }
};

/**
 * Callback if fetch was successful. Parses the feed and 
 * entries then goes to insert/update
 * 
 * Does not use a db
 * param since we will need a new db because async fetch
 * on a diff clock and connection not guaranteed still open.
 */
subscriptions.parseXML = function(url,feedId,xml,mime,notify,oncomplete,onerror,cfrules) {

  //console.log('Parsing %s', url);

  var fetchedFeed = null;
  try {
    fetchedFeed = xml2json.transform(xml);
  } catch(error) {
    console.log('parse exception %s', error);
    onerror({type:'parse',url:url,error:error});
    return;
  }

  //console.log('Parsed %s, title is %s, id is %s', url, fetchedFeed.title, feedId);

  // Stash the id if set
  if(feedId) {
    fetchedFeed.id = feedId;
  }

  // Stash the url
  fetchedFeed.url = url;

  // Stash the date last fetched in the feed object in prep for insert/update
  fetchedFeed.fetched = new Date().getTime();

  model.connect(function(db) {
    feedId ? subscriptions.updateFeed(db,fetchedFeed,notify,oncomplete,onerror,cfrules) :
      subscriptions.insertFeed(db,fetchedFeed,notify,oncomplete,onerror,cfrules);
  });
};

/**
 * Preps feed for insert, inserts, then notifies/broadcasts 
 * event. This only gets called when action=='add'
 */
subscriptions.insertFeed = function(db,fetchedFeed,notify,oncomplete,onerror,cfrules) {
  console.log('Inserting feed %s', fetchedFeed.url);

  // fetchedFeed is guaranteed to have url property. it only has id 
  // in update context. it only has fetched date property in 
  // insert/update context while online. it only has other properties 
  // if they were fetched while online.  
  var storableFeed = subscriptions.getStorableFeed(fetchedFeed);
 
  // Attach date created
  storableFeed.created = new Date().getTime();
   
  db.transaction('feed','readwrite').objectStore('feed').add(storableFeed).onsuccess = function(event){
    
    console.log('Inserted feed, new id %s', this.result);

    // Stash the new id in storableFeed in preparation for storage
    // or use in oncomplete
    storableFeed.id = this.result;

    if(fetchedFeed) {
      // Merge back into subscriptions.update path
      // Append true parameter for isNewSubscription
      subscriptions.addEntries(db,storableFeed,fetchedFeed,notify,oncomplete,onerror,cfrules,true);
    } else {
      // Assume fetchedFeed null means subscribing offline, we are done at this point 
      // as there are no entries to add since we presumably did not fetch
      // Pass back 0 for entriesProcessed, 0 for entriesAdded
      // Pass true for isNewSubscription
      subscriptions.oncomplete(storableFeed,oncomplete,notify,0,0,true);
    }
  };
};

subscriptions.updateFeed = function(db,fetchedFeed,notify,oncomplete,onerror,cfrules) {
  
  //console.log('Updating feed id %s url %s', fetchedFeed.id,fetchedFeed.url);

  // Now we want to overwrite the existing feed object for this feed

  // Fetched feed should contain id, url, and date fetched properties
  // so those get passed along
  var storableFeed = subscriptions.getStorableFeed(fetchedFeed);
  
  //console.log('Preparing to update %s', JSON.stringify(storableFeed));
  
  var feedStore = db.transaction('feed','readwrite').objectStore('feed');
  
  var getRequest = feedStore.get(storableFeed.id);
  
  // This can fire for db related issues, but will not fire if the feed 
  // does not exist. We still want to pass along such errors
  getRequest.onerror = function(error) {
    console.log('get request error when getting feed %s error %s', storableFeed.id, error);
    onerror({type:'dbrequestgetfeed',feedId:storableFeed.id,error:error});
  };

  getRequest.onsuccess = function(event) {
    var existingFeed = this.result;
    
    // onsuccess can fire without error but if the feed does not exist then 
    // event.target.value (aka this.value, getRequest.value) is null/undefined.
    // So technically still an error
    if(!existingFeed) {
      console.log('feed not found');
      return onerror({type : 'dbfeednotfound' , 'feedId' : storableFeed.id});
    }

    // Now overwrite some of the existing feeds values.
    // Do not replace id,created,url,schemeless. These are already set 
    // in the existingFeed object as it was loaded from the database.

    // The title of the feed could have changed
    if(storableFeed.title) {
      existingFeed.title = storableFeed.title;
    }
    
    // The description of the feed could have changed
    if(storableFeed.description) {
      existingFeed.description = storableFeed.description;
    }
    
    // The date in the feed could have changed
    if(storableFeed.date) {
      existingFeed.date = storableFeed.date;
    }

    // The link could have changed
    if(storableFeed.link) {
      existingFeed.link = storableFeed.link;
    }

    // Date updated always changes
    existingFeed.updated = new Date().getTime();

    // Set the date fetched, which storableFeed got from fetchedFeed.fetched 
    // inside the call to getStorableFeed. Note that it might not be set if 
    // we recode this later to still update on failed fetch? if failed fetch 
    // we never reached here in the first place, right?
    if(storableFeed.fetched) {
      existingFeed.fetched = storableFeed.fetched;  
    }

    // Temp code for one pass: check if created is not set. if it is not, set it to updated. It normally will 
    // always exist but I decided to only start storing it later after some 
    // feeds already existed
    if(!existingFeed.created) {
      existingFeed.created = existingFeed.updated;
    }

    // We replaced old properties with new properties in existingFeed object. Now stick it back
    // and continue on to storing entries.
    var putRequest = feedStore.put(existingFeed);
    
    // If we failed to update the feed here, send the error 
    // along to the global onerror callback
    putRequest.onerror = function(err) {
      onerror({type:'dbputfeed',feed:existingFeed});
    };

    putRequest.onsuccess = function(event) {
      //console.log('Updated feed id %s url %s', existingFeed.id, existingFeed.url);
      // We updated the feed, now update its entries (in a new tx)
      // We pass existingFeed here since it is the most 
      // up to date object with all of its properties set to current values.
      // This also rejoins the subscriptions.add path (if online)
      // Pass false for isNewSubscription
      subscriptions.addEntries(db,existingFeed,fetchedFeed,notify,oncomplete,onerror,cfrules,false);
    };
  };
};

subscriptions.addEntries = function(db,storedFeed,fetchedFeed,notify,oncomplete,onerror,cfrules,isNewSubscription) {

  //console.log('Adding %s entries for feed id %s', fetchedFeed.entries.length, storedFeed.id); 

  // Check if there are no entries and exit to oncomplete so that we actually exit 
  // as otherwise the iteration never fires a call to oncomplete (forEach just does nothing).
  if(!fetchedFeed.entries || !fetchedFeed.entries.length) {
    // Pass back 0 for entriesProcessed, 0 for entriesAdded
    return subscriptions.oncomplete(storedFeed, oncomplete,notify,0,0);
  }
  
  var entriesProcessed = 0, entriesAdded = 0;
  
  // Called by onUpdateSuccess and onUpdateError every time an entry 
  // is possibly inserted.
  var onUpdateComplete = function() {
    entriesProcessed++;
    // Note: we could use == but using >= as a safeguard, but I cannot 
    // currently see why == should not be used. We checked for 0 entries 
    // earlier. The only way this could happen is if we skip over entries 
    // somehow.
    if(entriesProcessed >= fetchedFeed.entries.length) {
      subscriptions.oncomplete(storedFeed,oncomplete,notify,entriesProcessed,entriesAdded,isNewSubscription);
    }
  };
  
  // Call back passed to subscriptions.addEntry
  
  var onUpdateSuccess = function() {
    //console.log('inserted entry');
    entriesAdded++;
    onUpdateComplete();
  };
  
  var onUpdateError = function() {
    // Do not increment entriesAdded here.
    onUpdateComplete();
  };
  

  collections.each(fetchedFeed.entries, function(fetchedEntry) {

    // Setup the new entry and do denormalization
    var storableEntry = {};

    // Now generate a hash value from the raw fetched values
    storableEntry.hash = subscriptions.generateEntryHash(fetchedEntry);
    if(!storableEntry.hash) {
      //console.log('addEntries skipping unhashable entry %s', JSON.stringify(fetchedEntry));
      onUpdateError();
      return;
    }
    
    var entryStore = db.transaction('entry','readwrite').objectStore('entry');
    var getHashRequest = entryStore.index('hash').get(IDBKeyRange.only(storableEntry.hash));
    getHashRequest.onerror = function(error) {
      //console.log('dbgethash error %s', fetchedEntry);
      onerror({type:'dbgethash',entry:fetchedEntry,error:error});
    };

    getHashRequest.onsuccess = function(event) {
      if(this.result) {
        // An entry with an identical hash code already exists 
        //console.log('An entry with hash code %s already exists, not inserting', storableEntry.hash);
        onUpdateError();
        return;
      }
      
      //console.log('New hash %s', storableEntry.hash);
      
      // Redundantly store feedLink to use it as the base uri for resolving elements in the content
      if(storedFeed.link) storableEntry.feedLink = storedFeed.link;
      // Redundantly store title for showing feed info in the view 
      if(storedFeed.title) storableEntry.feedTitle = storedFeed.title;

      // Note: in the old code I was cascading feed.date. I have no idea why
      // so just leaving this here as a reminder I no longer do that.
      //if(storedFeed.date) storableEntry.feedDate = storedFeed.date;

      // Set the foreign key 
      storableEntry.feed = storedFeed.id;

      // Initialze new entries as unread.
      storableEntry.unread = model.UNREAD;

      // Now set the fetched data. We only set defined properties
      // TODO: these values need cleaning prior to storage.
      if(fetchedEntry.author) storableEntry.author = fetchedEntry.author;
      if(fetchedEntry.link) storableEntry.link = fetchedEntry.link;
      if(fetchedEntry.title) storableEntry.title = fetchedEntry.title;

      var pubdate = dates.parseDate(fetchedEntry.pubdate);
      if(pubdate) {
        storableEntry.pubdate = pubdate.getTime();
      } else if(storedFeed.date) {
        // Use the global feed date as a fallback if it is set
        storableEntry.pubdate = storedFeed.date;
      }

      storableEntry.created = new Date().getTime();
      
      if(fetchedEntry.content) {
        storableEntry.content = subscriptions.prepareEntryContent(
          fetchedEntry.content, storableEntry.feedLink, cfrules);
      }
      
      var insertRequest = entryStore.add(storableEntry);
      insertRequest.onerror = onUpdateError;
      insertRequest.onsuccess = onUpdateSuccess;
      
    };// end hash check onsuccess

  });// end forEach
};

subscriptions.prepareEntryContent = function(text, baseURL, cfrules) {
  var doc = htmlParser.parse(text);
  // Note: using feedLink as base url parameter to sanitize 
  // and not entry.link. I am still not entirely sure which 
  // one is correct.  
  sanitizer.sanitize(baseURL, doc, cfrules);
  trimming.trimDocument(doc);
  return doc.innerHTML;
};


subscriptions.oncomplete = function(feed,onsuccess, notify, entriesProcessed,entriesAdded, isNewSubscription) {

  //console.log('Updated %s (%s/%s).', feed.url, entriesAdded,entriesProcessed);

  if(isNewSubscription) {
    extension.sendMessage({type:'subscribe',feed:feed});
  }
  
  // Notify. 
  // TODO: should this happen in the onsubscribe message listener or here?
  // TODO: should this check localStorage.NOTIFICATIONS_ENABLED?
  if(notify) {
    extension.notify('Subscribed to ' + feed.title + '. Found ' + 
        entriesAdded + ' new articles.');
  }

  // Note: feed.id is 0 if tried to update while offline, the only case
  onsuccess(feed, entriesProcessed, entriesAdded);
};

subscriptions.generateEntryHash = function(entry) {
  var seed = entry.link || entry.title || entry.content;
  if(seed) {
    return hashing.hashCode(seed.split(''));
  }  
};


// Returns a feed object prepped for storage in feed store
subscriptions.getStorableFeed = function(input) {
  var output = {};

  // Pass along feed id in update context.
  if(input.id) {
    output.id = input.id;
  }
  
  //console.log('storableFeed input.url is %s', input.url);
  
  // url is already prepped and always prepped.
  output.url = input.url;
  output.schemeless = subscriptions.getSchemelessURL(input.url);

  // A title is required to ensure the feed appears in the 
  // title index which is used by views
  if(input.title) {
    output.title = strings.stripTags(strings.stripControls(input.title));
  } else {
    output.title = '';
  }

  // Whether RSS allows it or not, some descriptions contain
  // HTML tags.
  if(input.description) {
    output.description = strings.stripTags(strings.stripControls(input.description));
  }

  // This should never need to be prepped but do it anyway
  if(input.link) {
    output.link = strings.stripControls(input.link);
  }

  // This corresponds to the date from the feed xml itself,
  // like the general pub date or date updated.
  if(input.date) {
    var d = dates.parseDate(strings.stripControls(input.date));
    if(d) {
      output.date = d.getTime();  
    }
  }

  if(input.fetched) {
    output.fetched = input.fetched;
  }
  
  if(input.created) {
    output.created = input.created;
  }
  
  if(input.updated) {
    output.updated = input.updated;
  }

  return output;
};