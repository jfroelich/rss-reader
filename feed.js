/**
 * Feed-related functions
 */


/**
 * Get all feed objects as an array
 */
function getAllFeeds(db, callback) {
  var feeds = [];

  var tx = db.transaction('feed');
  tx.oncomplete = function () {
    callback(feeds);
  }

  tx.objectStore('feed').openCursor().onsuccess = function(event) {
    var cursor = this.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    }
  };
}


function countDBFeeds(db, callback) {
  var feedStore = db.transaction('feed').objectStore('feed');
  feedStore.count().onsuccess = function(event) {
    callback(this.result);
  };
}



function getStorableFeed(input) {
  var output = {};

  if(input.id) output.id = input.id;

  output.url = input.url;
  output.schemeless = getSchemelessURL(input.url);

  if(input.title) {
    output.title = stripTags(stripControls(input.title));
  } else {
    output.title = stripTags(stripControls(input.url));
  }

  if(input.description) {
    output.description = stripTags(stripControls(input.description));
  }

  if(input.link) {
    output.link = stripControls(input.link);
  }

  if(input.date) {
    var d = parseDate(stripControls(input.date));
    if(d) output.date = d.getTime();
  }

  if(input.fetched) output.fetched = input.fetched;
  if(input.created) output.created = input.created;
  if(input.updated) output.updated = input.updated;
  return output;
}



FeedUpdate.prototype.preview = function(url,onsuccess,onerror,timeout) {

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
      feed.title = stripControls(feed.title);
      feed.title = stripTags(feed.title);
      if(feed.title) {
        result.title = feed.title;
      }
    }

    result.entries = [];
    feed.entries.forEach(function(entry) {
      var resultEntry = {};
      if(entry.title) {
        entry.title = entry.title.trim();
        entry.title = stripControls(entry.title);
        entry.title = stripTags(entry.title);
        resultEntry.title = entry.title;
      }

      if(!resultEntry.title) return;
      if(entry.content) {
        var doc = parseHTML(entry.content);
        sanitizer.sanitize(null, doc);
        trimming.trimDocument(doc);
        resultEntry.content = doc.textContent.substring(200);
      }
      result.entries.push(resultEntry);
    });

    onsuccess(result);
  };

  //subscriptions.request(url, onRequest, onerror, timeout);
  this.loadPreview(url, onRequest, onerror, timeout);
};

FeedUpdate.prototype.loadPreview = function(url, onsuccess, onerror, timeout) {
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
        return onerror({type:'requestxml',url:url});
      }

      if(!this.responseXML.documentElement) {
        return onerror({type:'docelement',url:url});
      }

      return onsuccess(this.responseXML, contentType);
    }

    if(/text\/(plain|html)/i.test(contentType)) {
      try {
        return onsuccess(parseXML(this.responseText), contentType);
      } catch(error) {
        return onerror({type:'requestparse',url:url,contentType: contentType,error:error});
      }
    }

    onerror({type:'requesttype',url:url,contentType:contentType});
  };

  request.open('GET', url, true);
  request.send();
};



/**
 * Remove feed (unsubscribe) and its dependent entries
 */
function removeFeedById(id) {
  console.log('removing %s', id);
  var counter = 0;
  var entryStore;

  openDB(function(db) {
    var tx = db.transaction(['entry','feed'],'readwrite');
    tx.objectStore('feed').delete(id);
    tx.oncomplete = onRemoveComplete;
    entryStore = tx.objectStore('entry');

    // TODO: can I pass id directly to openKeyCursor?
    var keys = entryStore.index('feed').openKeyCursor(IDBKeyRange.only(id));
    keys.onsuccess = deleteEntries;
  });

  function deleteEntries() {
    var keyCursor = this.result;
    if(keyCursor) {
      entryStore.delete(keyCursor.primaryKey);
      counter++;
      keyCursor.continue();
    }
  }

  function onRemoveComplete() {
    console.log('removed feed %s and %s entries', id, counter);
    chrome.runtime.sendMessage({type:'unsubscribe',feed:id,entriesDeleted:counter});
  }
}


/**
 * NOTE: this could maybe use an onerror as well?
 */
function findFeedBySchemelessURL(db, url, callback) {
  var schemelessURL = getSchemelessURL(feed.url);
  var schemelessIndex = db.transaction('feed').objectStore('feed').index('schemeless');
  schemelessIndex.get(schemelessURL).onsuccess = function() {
    callback(this.result);
  };
}



/************** FEED XML HANDLING **************************************
 * TODO: use getElementsByTagName instead of qsa?
 */

/**
 * TODO: this should not throw, it should do something else
 * like return an undefined object or a barely defined one
 *
 * TODO: i probably should go back to a single function, this is
 * is DRY code
 */
function createFeedFromXML(xml) {
  var rootName = xml.documentElement.localName;
  if(rootName == 'rss') {
    createFeedFromRSSXML(xml.documentElement);
  } else if(rootName == 'feed') {
    createFeedFromAtomXML(xml.documentElement);
  } else if(rootName == 'rdf:rdf') {
    createFeedFromRDFXML(xml.documentElement);
  } else {
    throw 'Invalid document element: ' + xml.documentElement.nodeName;
  }
}

function createFeedFromRSSXML(doc) {
  var result = { 'entries': [] };
  var entries = doc.querySelectorAll('channel item');
  var ft = findText;

  setIfNotEmpty(result,'title',ft(doc,['channel title']));
  setIfNotEmpty(result,'webmaster',ft(doc,['channel webMaster']));
  setIfNotEmpty(result,'author',ft(doc,['channel author','channel owner name']));
  setIfNotEmpty(result,'description',ft(doc,['channel description']));
  setIfNotEmpty(result,'link',ft(doc,['channel link:not([href])']));

  if(!result.link) {
    setIfNotEmpty(result,'link', ft(doc,['channel link'],'href'));
  }

  setIfNotEmpty(result,'date', ft(doc,
    ['channel pubDate','channel lastBuildDate','channel date']));

  each(entries, function(entry) {
    var e = {};
    setIfNotEmpty(e,'title', ft(entry,['title']));
    setIfNotEmpty(e,'link', ft(entry,['origLink','link']));
    setIfNotEmpty(e,'author', ft(entry,['creator','publisher']));
    setIfNotEmpty(e,'pubdate', ft(entry,['pubDate']));
    setIfNotEmpty(e,'content', ft(entry,['encoded','description','summary']));
    result.entries.push(e);
  });

  return result;
};

function createFeedFromAtomXML(doc) {
  var result = { 'entries': [] };
  var entries = doc.querySelectorAll('feed entry');
  var ft = findText;

  setIfNotEmpty(result,'title', ft(doc,['feed title']));
  setIfNotEmpty(result,'description',ft(doc,['feed subtitle']));
  setIfNotEmpty(result,'link', ft(doc,
    ['feed > link[rel="alternate"]','feed link[rel="self"]','feed link'],'href'));
  setIfNotEmpty(result,'author',ft(doc,['feed author name']));
  setIfNotEmpty(result,'date',ft(doc,['feed updated']));

  each(entries, function(entry) {
    var e = {};
    setIfNotEmpty(e,'title',ft(entry,['title']));
    setIfNotEmpty(e,'link', ft(entry,[
      'link[rel="alternate"]','link[rel="self"]',
      'link:not([href])','link[href]'
    ],'href'));
    setIfNotEmpty(e,'author',ft(entry,['author name']));
    setIfNotEmpty(e,'pubdate',ft(entry,['published','updated']));

    // TODO: clean this up
    var tmp = entry.querySelector('content');
    if(tmp) {
      var contents = [];
      each(tmp.childNodes, function(nd) {
        if(nd.nodeType == Node.ELEMENT_NODE) {
          contents.push(nd.innerHTML);
        } else if(nd.nodeType == Node.TEXT_NODE ||
          nd.nodeType == Node.CDATA_SECTION_NODE) {
          contents.push(nd.textContent);
        }
      });

      setIfNotEmpty(e,'content', contents.join('').trim());

      if(!e.content) {
        setIfNotEmpty(e,'content',tmp.textContent.trim());
      }
    }

    result.entries.push(e);
  });

  return result;
};

function createFeedFromRDFXML(doc) {
  var result = { 'entries': [] };
  var entries = doc.querySelectorAll('item');
  var ft = findText;

  setIfNotEmpty(result,'title',ft(doc,['channel > title']));
  setIfNotEmpty(result,'description', ft(doc,['channel > description']));
  setIfNotEmpty(result,'link', ft(doc,['channel > link:not([rel])']));

  if(!result.link) {
    setIfNotEmpty(result,'link', ft(doc,['channel > link[rel="self"]','channel > link'],'href'));
  }

  setIfNotEmpty(result,'date', ft(doc,['channel > date']));

  each(entries, function(entry) {
    var e = {};
    setIfNotEmpty(e,'title', ft(entry,['title']));
    setIfNotEmpty(e,'link', ft(entry,['link']));
    setIfNotEmpty(e,'author', ft(entry,['creator']));
    setIfNotEmpty(e,'pubdate', ft(entry,['date']));
    setIfNotEmpty(e,'content', ft(entry,['description']));
    result.entries.push(e);
  });

  return result;
}


// Returns true if the xml file is convertable.
function isXMLFeed(xml) {
  if(xml && xml.documentElement) {
    var name = xml.documentElement.localName;
    return name == 'rss' || name == 'feed' || name == 'rdf:rdf';
  }
}

/**
 * Set the value of the entry.link property to
 * the value returned by rewriteURL
 */
function rewriteEntryLink(entry) {
  //entry.originalLink = entry.link;
  entry.link = rewriteURL(entry.link);
}

/**
 * Returns true if an entry has a defined link property
 */
function entryHasLink(entry) {
  return entry.link;
}



function forEachFeed(db, callback, oncomplete, sortByTitle) {
  var tx = db.transaction('feed');
  tx.oncomplete = oncomplete;

  var store = sortByTitle ? tx.objectStore('feed').index('title') : tx.objectStore('feed');
  store.openCursor().onsuccess = function(event) {
    var cursor = event.target.result;
    if(cursor) {
      callback(cursor.value);
      cursor.continue();
    }
  };
}


/**
 * async
 */
function findEntryByLinkURL(db, url, callback) {
  var linkIndex = db.transaction('entry').objectStore('entry').index('link');
  linkIndex.get(url).onsuccess = function() {
    callback(this.result);
  };
}


/*************** POLLING *********************************************
 * TODO: needs more refactoring
 *
 * NOTE: POLL_ACTIVE is kind of like a lock
 */


function resetPollActive() {
  delete localStorage.POLL_ACTIVE;
}


/**
 *
 */
function startPolling() {

  var isPollRunning = localStorage.POLL_ACTIVE;

  if(isPollRunning) {
    console.log('Poll already in progress');
    return;
  }

  if(!navigator.onLine) {
    return;
  }

  localStorage.POLL_ACTIVE = '1';

  var totalEntriesAdded = 0, feedCounter = 0, totalEntriesProcessed = 0;
  var startTime = Date.now();
  var feedCounter = 0;
  openDB(onOpenDB);

  function onOpenDB(db) {
    getAllFeeds(db, onGetAllFeeds.bind(db));
  }

  function onGetAllFeeds(feeds) {
    feedCounter = feeds.length;
    if(feedCounter) {
      feeds.forEach(pollFeed, this);
    } else {
      pollCompleted();
    }
  }

  function pollFeed(feed) {
    var params = {};
    params.feed = feed;
    params.fetch = 1;
    params.timeout = 20 * 1000;
    params.db = this;
    params.onerror = function(error) {
      console.log(error);
    };
    params.oncomplete = function(polledFeed, processed,added) {
      totalEntriesProcessed += processed;
      totalEntriesAdded += added;
      if(--feedCounter < 1) {
        pollCompleted();
      }
    };

    updateFeed(params);
  }

  function pollCompleted() {
    delete localStorage.POLL_ACTIVE;
    localStorage.LAST_POLL_DATE_MS = String(Date.now());

    var endTime = Date.now();
    var elapsed = parseFloat(((endTime - startTime)/1000).toFixed(2));

    chrome.runtime.sendMessage({type:'pollCompleted',
      entriesAdded:totalEntriesAdded,
      feedsProcessed:feedCounter,
      entriesProcessed:totalEntriesProcessed,
      elapsed:elapsed});
  }
}