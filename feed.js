/**
 * Feed-related functions
 *
 * TODO: in the future, we should be storing two titles, a
 * human readonable one, and one for sorting when loading. Both
 * addFeed and updateFeed would be refactored.
 */

var feed = {};

/**
 * Adds the feed to the database. If successful,
 * calls oncomplete with the stored feed object and the
 * the number of entries added. If the feed already exists,
 * then the add is unsuccessful, and this calls onerror instead
 * with an error object.
 *
 * feed.url is required. This is not validated. It should already
 * be trimmed. Other properties are cleaned up.
 *
 * TODO: the caller needs to do sendmessage since whether to do this
 * varies per caller need (batch import, subscribe offline, subscribe)
 * //chrome.runtime.sendMessage({type:'subscribe',feed:feed});
 */
feed.add = function(db, remoteFeed, oncomplete, onerror) {
  console.log('feed.add url %s', remoteFeed.url);

  var storableFeed = {};
  var cleanedFeed = feed.sanitize(remoteFeed);

  // Set the url property. The url represents the feed's
  // HTTP location, and should not be confused with the feed's
  // link property. It is a string property.
  // The url is assumed to always be defined and non empty. This
  // is not checked. It will cause errors later. It is the
  // responsibility of the caller to ensure it is defined and not
  // empty. This function should not even be called in that case.
  // The url is not validated. It could be an invalid url
  // if added from an import or when subscribing offline. If
  // could just not even be a well-formatted URL. This could cause
  // errors later. We cannot catch these errors upfront because
  // no HTTP requests are involved. Some feature later on has to
  // delete such feeds after repeated fetch failures.
  // TODO: implement that code feature
  // The url is assumed to be canonical and absolute. If not the
  // same fetch errors errors will occur later.
  // The url should already be trimmed.
  // The url is not sanitized. The renderer should take care
  // when displaying the URL in HTML.
  storableFeed.url = remoteFeed.url;

  // Derive the schemeless property based on the url. This will be
  // used in the test for equality to determine if the feed
  // already exists.
  storableFeed.schemeless = getSchemelessURL(storableFeed.url);

  // Setup the feed's title.
  // TODO: set the human readable and system-usable titles
  // as two properties.

  if(cleanedFeed.title) {
    storableFeed.title = cleanedFeed.title;
  } else {
    // TODO: This is kind of ugly and should be improved.
    // Store an empty string. This is important so that
    // the title index picks up the feed, because the feed list on
    // the options page is displayed based on what the title index
    // contains. Undefined values are excluded from indexedDB indices.
    // So if we stored undefined, the feed would never appear in the
    // list.
    // NOTE: we cannot use url because it is not sanitized.
    // We use element.textContent or element.setAttribute to display
    // the url, but we use element.innerHTML to display the
    // title because titles can contain HTML entities. If we set title
    // to url then we would effectively be using element.innerHTML to
    // display the url which would be an XSS.

    // We could maybe do:
    // storableFeed.title = sanitizeString(remoteFeed.url);
    // but sanitize string is not suited for sanitizing urls
    // and could produce a funky string result.

    storableFeed.title = '';
  }

  if(cleanedFeed.description) {
    storableFeed.description = cleanedFeed.description;
  }

  if(cleanedFeed.link) {
    storableFeed.link =  cleanedFeed.link;
  }

  if(cleanedFeed.date) {
    storableFeed.date = cleanedFeed.date;
  }

  if(remoteFeed.fetched) {
    storableFeed.fetched = remoteFeed.fetched;
  }

  storableFeed.created = Date.now();

  feed.addToStore(db, storableFeed, function() {
    storableFeed.id = this.result;
    storableFeed.entries = remoteFeed.entries;
    mergeEntries(db, storableFeed, oncomplete);
  }, onerror);
};

/**
 * Updates the localFeed according to the properties in remoteFeed,
 * merges in any new entries present in the remoteFeed, and then
 * calls oncomplete.
 *
 * Certain properties of a feed can change on every update. For example,
 * the author of the remote feed file could change the feed's link property,
 * or the general date property (pubdate). The local representation of the
 * remote feed is updated to reflect some of the latest remote values every call
 * to updateFeed.
 *
 * It is the caller's responsibility to ensure that the fetched property
 * is set in the remoteFeed object, that the localFeed has an id and
 * all its old properties set (otherwise you could end up deleting properties).
 *
 * TODO: have the caller set a property in remoteFeed indicating
 * the last time the remote XML file was modified by the server.
 * We should store that every time in the localFeed. It should
 * also be stored initially if the initial storage was from
 * an online fetch. We should check that if both lastModifieds
 * are set, that the new one is different. If it is not
 * different than no change occurred and we can exit early.
 *
 * TODO: the date fetched and the date updated
 * seem to kind of the same thing. The idea is that
 * we could check a feed multiple times but never
 * notice any real changes. The fetched date should be
 * changed every fetch. However, the date updated should
 * only be changed if (1) the feed's properties changed,
 * or (2) new entries were added, (3) entries were removed
 * TODO: so this still needs some clarification and refactoring
 * I do not want to do a second database update.
 * First I need to update the feed's entries first, track how
 * many were added, and only then update the feed.  Second, I
 * need to check each individual property to see if it is
 * different than the old property.
 *
 * TODO: should this be called something like
 * synchronizeFeed? Or, rather should that be the name
 * of an outer function that couples fetch and update?
 *
 * @param db {IDBDatabase} - an open database connection
 * @param localFeed - the existing feed object retrieved from indexedDB
 * @param remoteFeed - the feed object retrieved from the remote URL
 * @param oncomplete - callback when finished, passed the updated
 * feed object, the number of entries processed, and the number of
 * entries added.
 */
feed.update = function(db, localFeed, remoteFeed, oncomplete) {

  // Sanitize relevant properties from the remote feed.
  // We will be re-inserting localFeed back into
  // the entry store, so update the localFeed object's
  // properties accordingly

  // In preparation, clean up relevant remote properties
  var cleanedFeed = feed.sanitize(remoteFeed);

  // Replace local title with cleaned remote title
  if(cleanedFeed.title) {
    localFeed.title = cleanedFeed.title;
  }

  // Replace local description with cleaned remote description
  if(cleanedFeed.description) {
    localFeed.description = cleanedFeed.description;
  }

  // Replace local link with cleaned remote link
  if(cleanedFeed.link) {
    localFeed.link = cleanedFeed.link;
  }

  // Replace local date with cleaned remote date
  if(cleanedFeed.date) {
    localFeed.date = cleanedFeed.date;
  }

  // Replace the date fetched. The caller should
  // have set this appropriately in the remoteFeed
  // argument.
  localFeed.fetched = remoteFeed.fetched;

  // Set the date updated to now
  localFeed.updated = Date.now();

  feed.putInStore(db, localFeed, function() {
    localFeed.entries = remoteFeed.entries;
    mergeEntries(db, localFeed, oncomplete);
  }, console.error);
};

/**
 * Adds a feed to the indexedDB feed store
 */
feed.addToStore = function(db, storableFeed, oncomplete, onerror) {
  var addRequest = db.transaction('feed','readwrite').objectStore('feed').add(storableFeed);
  addRequest.onsuccess = oncomplete;
  addRequest.onerror = onerror;
};

/**
 * Puts a feed into the indexedDB feed store.
 *
 * @param db - open database connection
 * @param feed - the feed object to put
 * @param oncomplete - the callback to call
 */
feed.putInStore = function(db, storableFeed, oncomplete, onerror) {
  var putRequest = db.transaction('feed','readwrite').objectStore('feed').put(storableFeed);
  putRequest.onsuccess = oncomplete;
  putRequest.onerror = onerror;
};

/**
 * Returns a sanitized version of a remote feed object.
 * The remoteFeed object is not modified.
 *
 * Properties of the returned feed object are only set if
 * they are non-empty after sanitization.
 *
 * Only certain properties are sanitized based on whether
 * the property was system or user-generated.
 *
 * Entries in the feed.entries property are not sanitized.
 */
feed.sanitize = function(remoteFeed) {
  var output = {};

  // Sanitize the title. Note that this does not sanitize
  // HTML entities in the title.
  var title = feed.sanitizeString(remoteFeed.title);
  if(title) {
    output.title = title;
  }

  // Sanitize the description. Some feed descriptions contain
  // HTML, but we do not allow that.
  // NOTE: this does not sanitize HTML entities in the description
  var description = feed.sanitizeString(remoteFeed.description);
  if(description) {
    output.description = description;
  }

  // TODO:  Are we possibly fudging the value of link?
  // For now sanitize it generally but this may need
  // special handling.
  // NOTE: html entities are not sanitized.
  var link = feed.sanitizeString(remoteFeed.link);
  if(link) {
    output.link = link;
  }

  // Date was prepped by the fetcher to just be a timestamp in ms.
  // This is user-generated in the sense that the date was stored in a string
  // like format in the remote feed. However, the function that parses
  // the feed's XML, and the function that creates a feed object from that
  // XML, change the value into a date. So it would be already sanitized
  //  by the fact that it is parsed into a date and then converted into a
  // timestamp. The parse would not have produced a valid date if there were
  // evil characters, and even then, we are only referencing the
  // value produced by Date.getTime(), so there is 0 chance of XSS.
  // NOTE: we do not, however, bother to check this is a valid timestamp.
  // That is the caller's responsibility. We just pass it along.

  // TODO: since this does not need to be sanitized then we
  // do not need to do this here. The caller should not expect
  // a date property in the output object. date is treated
  // similar to url in how it is assumed to be partly
  // sanitized.

  if(remoteFeed.date) {
    output.date = remoteFeed.date;
  }

  return output;
};

/**
 * Sanitizes a string
 *
 * TODO: should we replace HTML entities after
 * stripping tags? Some entities? All entities?
 *
 */
feed.sanitizeString = function(str) {

  if(!str) {
    return;
  }

  // Parse the string as HTML and then
  // strip any HTML from it.
  str = stripTags(str);

  // Replace all special characters
  if(str) {
    str = stripControls(str);
  }

  // Replace sequences of multiple whitespace
  // characters with a single space.
  // TODO: this should be a call to a separate function
  // or maybe merged with stripControls
  // (one pass instead of two)
  if(str) {
    str = str.replace(/\s+/,' ');
  }

  // If there is anything left in the string, trim it.
  if(str) {
    str = str.trim();
  }

  // Return the str (which may now be just an empty str)
  return str;
};

/**
 * Gets all feed objects in the feedstore as an array
 */
feed.getAll = function(db, callback) {
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
};

/**
 * Counts the number of feeds in the feed store
 */
feed.countAll = function(db, callback) {
  var feedStore = db.transaction('feed').objectStore('feed');
  feedStore.count().onsuccess = function(event) {
    callback(this.result);
  };
};

/**
 * Removes a feed and its dependent entries
 *
 * //Callers responsibility, dont do this here
 * //chrome.runtime.sendMessage({type:'unsubscribe',feed:id,entriesDeleted:counter});
 */
feed.removeById = function(db, id, oncomplete) {
  //console.log('removing %s', id);

  var counter = 0,
      entryStore,
      tx = db.transaction(['entry','feed'],'readwrite'),
      keys;

  tx.objectStore('feed').delete(id);
  entryStore = tx.objectStore('entry');
  tx.oncomplete = function () {
    oncomplete(id, counter);
  };

  // TODO: is IDBKeyRange necessary?
  keys = entryStore.index('feed').openKeyCursor(IDBKeyRange.only(id));
  keys.onsuccess = function() {
    var keyCursor = this.result;
    if(keyCursor) {
      entryStore.delete(keyCursor.primaryKey);
      counter++;
      keyCursor.continue();
    }
  };
};

/**
 */
feed.findBySchemelessURL = function(db, url, callback) {
  var schemelessURL = getSchemelessURL(feed.url);
  var schemelessIndex = db.transaction('feed').objectStore('feed').index('schemeless');
  schemelessIndex.get(schemelessURL).onsuccess = function() {
    callback(this.result);
  };
};


/************** FEED XML HANDLING **************************************
 * TODO: use getElementsByTagName instead of qsa?
 */

/**
 * TODO: this should not throw, it should do something else
 * like return an undefined object or a barely defined one
 *
 * TODO: DRY violation. This is like a function factory but the behavior of the
 * 3 functions it returns does not greatly differ. Use a single function
 * with lots of if statements.
 */
feed.fromXML = function(xml) {
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
};

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





/*
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
};*/