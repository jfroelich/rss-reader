/**
 * Routines for managing subscriptions
 *
 */
var subscriptions = {};

/**
 * @param params - holder of properties url, fetch, notify, timeout, onerror
 */
subscriptions.add = function(params) {
  
  console.log('called subscriptions.add with params %s', JSON.stringify(params));
  // TODO: use update when updating and migrating 
  // feedupdater code to here, then make all the appropriate 
  // functions change behavior based on action context
  params.action = 'add';
  
  // Ensure onerror is set so we do not have to check it 
  // again.
  params.onerror = params.onerror || subscriptions.defaultErrorHandler;

  // Cache original for onerror callback
  params.originalURL = params.url;

  // Define a simple helper function (which should probably 
  // be in strings.js)
  var prep = function(str) {
    return str.replace(/[\t\r\n]/g,'');
  };

  // Prep url for processing
  params.url = prep((params.url || '').trim());

  // Validate the url (which also returns false if url is falsey)
  if(!URI.isValid(URI.parse(params.url))) {
    
    console.log('refused to add invalid url %s', params.originalURL);
    
    params.onerror({type:'invalidurl',url:params.originalURL});
    return;
  }

  // Connect if needed and then check if url exists.
  if(params.db) {
    subscriptions.addCheckExists_(params);
  } else {
    model.connect(function(db) {
      params.db = db;
      subscriptions.addCheckExists_(params);
    });  
  }
};

subscriptions.update = function(params) {
  
  console.log('subscription.update called with params %s', JSON.stingify(params));
  
  params.fetch = true;// must be true or pointless to execute
  
  params.action == 'update';
  
  // default error handler.
  params.onerror = params.onerror || subscriptions.defaultErrorHandler;
  
  // Load rules once at start.
  params.contentFilterRules = contentFiltering.loadRules();

  if(params.db) {
    subscriptions.fetch(params);
  } else {
    model.connect(function(db) {
      subscriptions.fetch(params);
    });
  }
};

subscriptions.remove = function(feedId) {
  console.log('Unsubscribing for feed %s', feedId);
  model.connect(function(db) {
    var counter = 0, message = {type: 'unsubscribe',feed: feedId};
    var tx = db.transaction(['entry','feed'],'readwrite');
    tx.objectStore('feed').delete(feedId);
    tx.oncomplete = function(event) {
      message.entriesDeleted = counter;
      chrome.runtime.sendMessage(message);
    };

    var entries = tx.objectStore('entry');
    var range = IDBKeyRange(feedId);
    var keys = entries.index('feed').openKeyCursor(range);
    keys.onsuccess = function(event) {
      var cursor = event.target.result;
      if(cursor) {
        entries.delete(cursor.primaryKey);
        counter++;
        cursor.continue();
      }
    };
  });
};

/**
 * Check whether the url already exists in the 
 * database, without its scheme. If it does, error out.
 * If it does not, go to fetch
 */
subscriptions.addCheckExists_ = function(params) {

 console.log('Checking if %s exists', params.url);

  var schemeless = URI.parse(params.url);
  delete schemeless.scheme;
  
  schemeless = URI.toString(schemeless);

  // gotta substring due to bug in URI.toString
  if(schemeless.indexOf('/') == 0) 
    schemeless = schemeless.substring(2);

  console.log('schemeless is %s', schemeless);

  params.db.transaction('feed').objectStore('feed').index(
    'schemeless').get(schemeless).onsuccess = function(event) {

    if(event.target.value) {
      console.log('%s already exists', params.url);
      params.onerror({type:'exists',url:params.url,
        existingurl:event.target.value.url});
    } else {
      subscriptions.fetch(params);
    }
  };  
};

/**
 * If supposed to fetch and online, then fetch. Otherwise
 * skip ahead to insert/update.
 */
subscriptions.fetch = function(params) {

  console.log('fetching %s', params.url);

  if(params.fetch && navigator.onLine) {
    console.log('called while online');
    fetcher.fetch(params.url, function(xml, mime) {
      params.xml = xml;
      params.mime = mime;
      subscriptions.onFetchSuccess(params);
    }, function(err) {
      params.err = err;
      subscriptions.onFetchError(params);
    }, params.timeout);

    return;
  }

  console.log('called while offline');

  if(params.action == 'add') {
    // Stash a new feed object in preparation for insert
    params.feed = {url:params.url};
    subscriptions.insertFeed_(params);      
  } else if(params.action == 'update') {
    console.log('cannot update while offline');
    //params.storable = {};
    //params.storable.feedId = params.feedId;
    //params.storable.url = params.url;
    params.entriesProcessed = 0;
    params.entriesAdded = 0;
    subscriptions.onCompleted_(params);
  } else {
    console.log('invalid action, %s', JSON.stringify(params));
  }
};

/**
 * Callback if fetch was successful.
 */
subscriptions.onFetchSuccess = function(params) {
  console.log('fetch success, preparing to parse %s', params.url);

  try {
    params.feed = xml2json.transform(params.xml);
  } catch(exception) {
    // Parse exception
    params.onerror({type:'parse',url:params.url,details:exception,params:params});
    return;
  }

  // Stash the url in the feed object in prep for insert/update
  params.feed.url = params.url;

  // Stash the date last fetched in the feed object in prep for insert/update
  params.feed.fetched = new Date().getTime();

  // Reconnect after async XMLHttpRequest in case it closed
  model.connect(function(db) {

    // Overwrite the old connection then goto insert/update
    params.db = db;

    if(params.action == 'add') {
      subscriptions.insertFeed_(params);
    } else if(params.action == 'update') {
      subscriptions.updatedFeed(params);
    } else {
      console.log('invalid action %s', JSON.stringify(params));
    }
  });
};

/**
 * Callback if fetch err when adding subscription
 */
subscriptions.onFetchError = function(params) {
  console.log('onFetchError %s %s', params.url, params.err);

  // TODO: consider varying behavior based on fetch status. inspect err.
  
  if(params.action == 'add') {
    // No action needed? In case of insert fetch failure there is 
    // nothing to do. there is no feed in the db.
  } else if(params.action == 'update') {
    // TODO: do we need to do a side update here of fetched date?
    // or 'last checked date' or whatever it should be called in 
    // case of an update? i think we do.
    // Note since we are post async we are on diff clock so need new 
    // db conn if we do anything.
  }

  // For now this is the behavior.
  params.onerror({type:'fetch',url:params.url,details:err});  
};

/**
 * Preps feed for insert, inserts, then notifies/broadcasts 
 * event. This only gets called when action=='add'
 */
subscriptions.insertFeed_ = function(params) {
  
  params.storable = subscriptions.getStorableFeed(params.feed);
  
  console.log('inserting original %s storing %s', params.feed, params.storable);
  
  params.db.transaction('feed').objectStore('feed').add(
    params.storable).onsuccess = function(event){
    
    console.log('insert feed completed, new id %s', event.target.value);
    
    // TODO: which one am i using here? for now both but id 
    // rather just use id.
    // Shove new id into params before calling oncompleted
    params.storable.feedId = event.target.value;
    params.storable.id = event.target.value;

    if(!params.fetch) {
      subscriptions.subscribeCompleted_(params);
      return;
    }

    subscriptions.addEntries_(params);
  };
};

// Insert the entries then call subscribeCompleted_
subscriptions.addEntries_ = function(params) {
  console.log('adding %s entries for %s', params.feed.entries.length, params.url);
  if(!params.feed.entries.length) {
    subscriptions.onCompleted_(params);
    return;
  }

  params.entriesProcessed = 0;
  params.entriesAdded = 0;

  params.onEntryUpdateSuccess = function() {
    console.log('entry update success');
    params.entriesAdded++;
    if(++params.entriesProcessed >= params.feed.entries.length) {
      subscriptions.onCompleted_(params);
    }
  };

  params.onEntryUpdateError = function() {
    console.log('entry update error');
    if(++params.entriesProcessed >= params.feed.entries.length){
      subscriptions.onCompleted_(params);
    }
  };

  console.log('iterating over %s entries', params.feed.entries.length);

  collections.each(params.feed.entries, function(entry) {
    // Setup the new entry, cascade denormalized values from feed into entry
    var storableEntry = {};
    
    if(params.storable.link) storableEntry.feedLink = params.storable.link;
    if(params.storable.title) storableEntry.feedTitle = params.storable.title;
    if(params.storable.date) storableEntry.feedDate = params.storable.date;
    storableEntry.feed = params.storable.feedId;
    storableEntry.unread = model.UNREAD;
    if(entry.author) storableEntry.author = entry.author;
    if(entry.link) storableEntry.link = entry.link;
    if(entry.title) storableEntry.title = entry.title;
    storableEntry.hash = subscriptions.generateEntryHash(entry);
    
    var pubdate = dates.parse(entry.pubdate);
    if(pubdate) {
      storableEntry.pubdate = pubdate.getTime();
    } else if(params.storable.date) {
      storableEntry.pubdate = params.storable.date;
    }
    
    if(!hash) {
      console.log('could not generate hash for entry %s', JSON.stringify(entry));
      params.onEntryUpdateError();
      return;
    }
    
    console.log('checking if entry exists');
    var entryStore = params.db.transaction('entry','readwrite').objectStore('entry');
    entryStore.index('hash').get(IDBKeyRange.only(hash)).onsuccess = function(event) {
      if(event.target.value) {
        console.log('entry with hash %s already exists', event.target.value.hash);
        params.onEntryUpdateError();
        return;
      }
      
      console.log('entry does not exist, setting up content');
      
      // After checking existence, then set the content property that does 
      // some heavy lifting
      if(entry.content) {
        var doc = htmlParser.parse(entry.content);
        sanitizer.sanitize(storableEntry.feedLink, doc, params.contentFilterRules);
        trimming.trimDocument(doc);
        storableEntry.content = doc.innerHTML;
      }

      console.log('Requesting to insert entry %s', storableEntry.title);
      var insertEntryRequest = entryStore.add(storableEntry);
      insertEntryRequest.onsuccess = params.onEntryUpdateSuccess;
      insertEntryRequest.onerror = params.onEntryUpdateError;
    };
  });
};

subscriptions.generateEntryHash = function(entry) {
  var seed = entry.link || entry.title || entry.content;
  if(seed) {
    return hashing.hashCode(seed.split(''));
  }  
};

subscriptions.onCompleted_ = function(params) {
  console.log('reached subscriptions.onCompleted');

  // TODO: params.storable.feedId is the new id of the feed if in add context.
  // the code below needs to take this into account.
  // TODO: id like to use params.storable.id
  
  if(params.action == 'add' && params.onImportComplete) {
    // call oncomplete for import context
    console.log('import completed for %s', params.url);
    params.oncomplete(params);
    return;
  }

  if(params.action == 'update') {
    console.log('update completed');
    if(!params.storable) {
      console.log('missing storable, lazy creation with just url');
      params.storable = {};
      params.storable.url = params.url;
    }
    
    params.onUpdateComplete(params.storable, params.entriesProcessed, params.entriesAdded);
    return;
  }

  if(params.action == 'add') {
    console.log('add completed, broadcasting message, feed info %s', params.storable);

    if(params.notify) {
      console.log('notifying');
      notifications.show('Subscribed to ' + params.storable.title + '. Found ' + 
        params.entriesAdded + ' new articles.');
    }
    
    chrome.runtime.sendMessage({type:'subscribe',feed:params.storable});
  }
};

// Returns a feed object prepped for storage in feed store
subscriptions.getStorableFeed = function(input, url) {
  var output = {};
  
  // This probably belongs in strings
  var prep = function(str) {
    return str.replace(/[\t\r\n]/g,'');
  };
  

  // url is already prepped
  output.url = url;

  // Setup the schemeless property
  var uri = URI.parse(url);
  delete uri.scheme;
  output.schemeless = URI.toString(uri);

  // A title is required to ensure the feed appears in the 
  // title index which is used by views
  if(input.title) {
    output.title = strings.stripTags(prep(input.title));
  } else {
    output.title = '';
  }

  // Whether RSS allows it or not, some descriptions contain
  // HTML tags.
  if(input.description) {
    output.description = strings.stripTags(prep(input.description));
  }

  // This should never need to be prepped but do it anyway
  if(input.link) {
    output.link = prep(input.link);
  }

  // This corresponds to the date from the feed itself,
  // like the general pub date or date updated.
  if(input.date) {
    var d = dates.parse(pre(input.date));
    if(d) {
      output.date = d.getTime();  
    }
  }
  
  return output;
};

subscriptions.defaultErrorHandler = function(err){
  // TODO: comment this out when done debugging.
  console.dir(err);
};