/**
 * Backend lib
 */

/******************** BACKGROUND/EXTENSION **********************************************
 * Functions that happen in the background event page
 */

function onBackgroundMessage(message) {
  if('subscribe' == message.type) {
    updateBadge();
  } else if('unsubscribe' == message.type) {
    updateBadge();
  } else if('pollCompleted' == message.type) {
    //console.log('Polling completed. Processed %s feeds. '+
    //'Added %s entries. %s seconds elapsed.',
    //message.feedsProcessed, message.entriesAdded, message.elapsed);

    updateBadge();
    if(message.entriesAdded) {
      showNotification(message.entriesAdded + ' new articles added.');
    }
  }
}

function onBrowserActionClick() {
  var viewURL = chrome.extension.getURL('slides.html');

  chrome.tabs.query({'url': viewURL}, function(tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active:true});
    } else {
      chrome.tabs.query({url: 'chrome://newtab/'}, function(tabs) {
        if(tabs.length)
          chrome.tabs.update(tabs[0].id, {active:true,url: viewURL});
        else
          chrome.tabs.create({url: viewURL});
      });
    }
  });
}

function onExtensionStarted() {
  console.log('onStartup');
}

/**
 * This only gets bound in background.js
 */
function onExtensionInstalled() {
  console.log('Installing extension');

  // This triggers a database install i think, and also
  // i think inits badge to 0
  updateBadge();

  // These bindings only need to happen once, at install time.
  chrome.runtime.onSuspend.addListener(onExtensionSuspended);
  chrome.runtime.onStartup.addListener(onExtensionStarted);
  chrome.browserAction.onClicked.addListener(onBrowserActionClick);
  chrome.runtime.onMessage.addListener(onBackgroundMessage);
  chrome.alarms.onAlarm.addListener(onExtensionAlarm);
  chrome.alarms.create('poll', {periodInMinutes: 20});
}

var INACTIVITY_INTERVAL = 60 * 5;

function onExtensionAlarm() {
  if('poll' == alarm.name) {
    chrome.permissions.contains({permissions: ['idle']}, function(permitted) {
      if(permitted) {
        chrome.idle.queryState(INACTIVITY_INTERVAL, function (newState) {
          if(newState == 'locked' || newState == 'idle') {
            polling.start();
          }
        });
      } else {
        polling.start();
      }
    });
  }
}

// NOTE: largely just for testing, I am not
// doing anything special at the moment
function onExtensionSuspended() {
  console.log('Extension suspended');
}

/************************ INSERT/UPDATE FEED ******************************************
 * Refactoring from feed update
 */

// props: timeout, db, notify, fetch, onerror, oncomplete

var FeedUpdate = function() {
  this.CREATE = 1;
  this.UPDATE = 2;
};

FeedUpdate.prototype.add = FeedUpdate.prototype.create = function(url) {
  this.url = stripControls(url.trim());
  this.actionType = this.CREATE;
  this.insertOrUpdate();
};

FeedUpdate.prototype.update = function(id, url) {
  this.feedId = id;
  this.url = stripControls(url.trim());
  this.actionType = this.UPDATE;
  this.insertOrUpdate();
};

FeedUpdate.prototype.remove = function(feedId) {
  model.connect(function(db) {
    var tx = db.transaction(['entry','feed'],'readwrite');
    tx.objectStore('feed').delete(feedId);
    tx.oncomplete = function(event) {
      chrome.runtime.sendMessage({type:'unsubscribe',feed:feedId,deleted:counter});
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



////////////////////////////////////////////////////////////////////
// Private methods (should not call but atm I am not bothering to
// protect with an IEAF)

FeedUpdate.prototype.insertOrUpdate = function() {
  var self = this;
  this.onerror = this.onerror || noop;

  if(this.actionType == this.CREATE) {

    // Ensure the url is valid
    if(!URI.isValidString(this.url)) {
      this.onerror({type:'invalidurl',url:this.url});
      return this.dispatchOncomplete();
    }

    // If creating, start by checking that we are not
    // subscribed, and then start fetching.

    if(this.db) {
      this.fetchFeedIfNotExists();
    } else {
      model.connect(function(db) {
        self.db = db;
        self.fetchFeedIfNotExists();
      });
    }
  } else if(this.actionType == this.UPDATE) {

    // If updating, go straight to fetching

    self.fetchFeed();
  }
};

FeedUpdate.prototype.fetchFeedIfNotExists = function() {
  var schemelessURL = getSchemelessURL(this.url);
  var schemelessIndex = this.db.transaction('feed').objectStore('feed').index('schemeless');
  var self = this;
  schemelessIndex.get(schemelessURL).onsuccess = function(event) {
    if(event.target.result) {
      self.onerror({type:'exists',url:self.url,feed:event.target.result});
      self.dispatchOncomplete();
    } else {
      self.fetchFeed();
    }
  };
};

FeedUpdate.prototype.fetchFeed = function() {
  //console.log('fetchFeed %s', this.url);

  if(this.fetch && navigator.onLine) {

    var request = new FeedHttpRequest();
    request.timeout = this.timeout;
    request.onerror = this.onerror;
    request.oncomplete = this.onFeedLoaded.bind(this);
    request.send(this.url);
    return;
  }

  // If we are not fetching or not online

  if(this.actionType == this.CREATE) {
    var self = this;

    // Ensure database connection
    model.connect(function(db) {
      self.db = db;

      // TODO: insert feed? maybe we want mixed 'insertorupdateFetchedFeed'

      // Since we are not fetching, simulate a fetchedFeed object
      self.fetchedFeed = {url:self.url};

      self.insertFeed();
    });
  } else if(this.actionType == this.UPDATE) {

    // Since we are not updating, simulate an updatedFeed object
    // self.storedFeed = {id:0,url:self.url};
    // We are done.
    this.dispatchOncomplete();
  }
};

FeedUpdate.prototype.onFeedLoaded = function(feed) {

  //console.log('FeedUpdate.onFeedLoaded %s', feed);

  if(!feed) {
    // A problem occurred while fetching. The error was
    // dispatched by the onerror callback from FeedHttpRequest
    // so we are done
    this.dispatchOncomplete();
    return;
  }

  // Stash the fetchedFeed object
  this.fetchedFeed = feed;

  // Set the date fetched to now.
  this.fetchedFeed.fetched = Date.now();

  // Ensure database connection
  var self = this;
  model.connect(function(db) {
    self.db = db;
    if(self.actionType == self.CREATE) {
      self.insertFeed();
    } else if(self.actionType = self.UPDATE) {
      self.updateFeed();
    }
  });
};

FeedUpdate.prototype.insertFeed = function() {
  console.log('Inserting %s', this.url);

  this.fetchedFeed.url = this.url;
  this.storedFeed = this.getStorableFeed(this.fetchedFeed);
  this.storedFeed.created = Date.now();

  var self = this;
  var feedStore = this.db.transaction('feed','readwrite').objectStore('feed');

  feedStore.add(this.storedFeed).onsuccess = function(event) {

    console.log('Inserted %s, new id is %s', self.url, this.result);

    self.storedFeed.id = this.result;

    if(self.fetchedFeed && self.fetchedFeed.fetched) {
      self.addEntries();
    } else {
      self.dispatchOncomplete();
    }
  };
};

FeedUpdate.prototype.updateFeed = function() {

  //console.log('FeedUpdate.updateFeed id %s url %s', this.feedId, this.url);

  var self = this;

  this.fetchedFeed.id = this.feedId;
  this.fetchedFeed.url = this.url;
  this.storedFeed = this.getStorableFeed(this.fetchedFeed);

  var tx = this.db.transaction('feed','readwrite');
  var feedStore = tx.objectStore('feed');
  feedStore.get(this.feedId).onsuccess = function(event) {
    var existingFeed = this.result;

    if(!existingFeed) {
      self.onerror({type:'feednotfound',feedId: self.feedId});
      return self.dispatchOncomplete();
    }

    if(self.storedFeed.title) existingFeed.title = self.storedFeed.title;
    if(self.storedFeed.description)
      existingFeed.description = self.storedFeed.description;
    if(self.storedFeed.date) existingFeed.date = self.storedFeed.date;
    if(self.storedFeed.link) existingFeed.link = self.storedFeed.link;
    if(self.storedFeed.fetched) existingFeed.fetched = self.storedFeed.fetched;

    existingFeed.updated = Date.now();
    if(!existingFeed.created) existingFeed.created = existingFeed.updated;

    // Note: not 100% sure why, but we must bind addEntries to self
    // as 'this' is set to an IDBRequest object.

    feedStore.put(existingFeed).onsuccess = self.addEntries.bind(self);
  };
};

FeedUpdate.prototype.getStorableFeed = function(input) {
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
};

FeedUpdate.prototype.addEntries = function() {

  //console.log('FeedUpdate.addEntries %s', this.url);

  if(!this.fetchedFeed || !this.fetchedFeed.entries || !this.fetchedFeed.entries.length) {
    return this.dispatchOncomplete();
  }

  this.entriesProcessed = 0;
  this.entriesAdded = 0;

  var self = this;

  var onUpdateComplete = function() {
    self.entriesProcessed++;
    if(self.entriesProcessed >= self.fetchedFeed.entries.length) {
      self.dispatchOncomplete();
    }
  };

  var onUpdateSuccess = function() {
    self.entriesAdded++;
    onUpdateComplete();
  };

  var onUpdateError = function() {
    onUpdateComplete();
  };

  each(this.fetchedFeed.entries, function(fetchedEntry) {

    var storableEntry = {};
    storableEntry.hash = self.generateEntryHash(fetchedEntry);
    if(!storableEntry.hash) {
      return onUpdateError();
    }

    var tx = self.db.transaction('entry','readwrite');
    var entryStore = tx.objectStore('entry');
    var hashIndex = entryStore.index('hash');

    hashIndex.get(storableEntry.hash).onsuccess = function(event) {
      if(this.result) {
        return onUpdateError();
      }

      if(self.storedFeed.link) storableEntry.feedLink = self.storedFeed.link;
      if(self.storedFeed.title) storableEntry.feedTitle = self.storedFeed.title;

      storableEntry.feed = self.storedFeed.id;
      storableEntry.unread = 1;

      if(fetchedEntry.author) storableEntry.author = fetchedEntry.author;
      if(fetchedEntry.link) storableEntry.link = fetchedEntry.link;
      if(fetchedEntry.title) storableEntry.title = fetchedEntry.title;

      var pubdate = parseDate(fetchedEntry.pubdate);
      if(pubdate) storableEntry.pubdate = pubdate.getTime();
      else if(self.storedFeed.date) storableEntry.pubdate = self.storedFeed.date;

      storableEntry.created = Date.now();

      if(fetchedEntry.content) {
        // We are sanitizing, trimming, and rewriting/resolving urls in real time
        /// on render instead of here.
        storableEntry.content = fetchedEntry.content;
      }

      var addRequest = entryStore.add(storableEntry);
      addRequest.onerror = function() {
        console.log('Failed to add entry %s', storableEntry.link);
        onUpdateError();
      };
      addRequest.onsuccess = function() {
        //console.log('Added entry %s', storableEntry.link);
        onUpdateSuccess();
      };
    };
  });
};

FeedUpdate.prototype.generateEntryHash = function(entry) {
  var seed = entry.link || entry.title || entry.content;
  if(seed) {
    return generateHashCode(seed.split(''));
  }
};

FeedUpdate.prototype.dispatchOncomplete = function() {

  if(this.storedFeed) {
    if(this.actionType == this.CREATE) {
      chrome.runtime.sendMessage({type:'subscribe',feed:this.storedFeed});
    }

    if(this.notify) {
      notify('Subscribed to '+this.storedFeed.title+'. Found '+this.entriesAdded+' new articles.');
    }

    this.oncomplete(this.storedFeed, this.entriesProcessed, this.entriesAdded);
  } else {
    // This was called after some error that skipped storage.
    // Still need to call oncomplete, but we do it without info.
    // NOTE: will callers react appropriately? how?
    this.oncomplete();
  }

};


/************************ FETCH FEED **************************************************
 * Fetches the XML for a feed from a URL, then parses it into
 * a javascript object, and passes this along to a callback. If an error
 * occurs along the way, calls an error callback instead. Async.
 *
 * For each entry, it checks if the entry has a link. If the entry has
 * a link, this also sends subsequent requests to get the full html
 * of the link and uses that instead of the entry.content property that
 * was provided from within the xml feed.
 *
 * NOTE: onerror could be passed an XMLHttpRequest event containing an error,
 * an exception, a string, or a custom object
 * NOTE: unlike old API, oncomplete is not always called, onerror is called instead
 * so make note of that there are now two exit points not one with a possible
 * side effect.
 *
 * TODO: separate timeout for feed fetch and web page fetch
 * TODO: option to fetch/not fetch webpages instead of always fetch
 * TODO: formalize/standardize the parameter to onerror?
 * TODO: is an approach that uses overrideMimeType better than
 * checking content type?
 *
 * @param params {object} an object literal that should contain props:
 * - url the remote url of the feed to fetch
 * - oncomplete - a callback to call when the feed is fetched, that is passed
 * a javascript object representing the contents of the feed
 * - onerror - a callback to call in case of an error, that is called instead
 * of oncomplete
 * - timeout - optional timeout before giving up on feed (or web pages)
 * - augmentEntries - if true, fetches full content of entry.link and
 * uses that instead of the feed content
 * - augmentImageData - augment image data in fetched web pages
 * - rewriteLinks - if true, entry.link values are rewritten in the feed
 * prior to fetching or checking if already fetched in db
 * - entryTimeout - optional timeout before giving up on fetching webpage for entry
 */
function fetchFeed(params) {
  var url = (params.url || '').trim();
  var oncomplete = params.oncomplete || noop;
  var onerror = params.onerror || noop;
  var timeout = timeout;
  var augmentImageData = params.augmentImageData;
  var augmentEntries = params.augmentEntries;
  var rewriteLinks = params.rewriteLinks;

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;
  request.onload = onFeedLoaded;
  request.open('GET', url, true);
  request.send();

  // Gets the xml from the response and handoffs to createFeedFromXML
  // or onerror
  function onFeedLoaded() {
    // TODO: does getResponseHeader ever return undefined?
    // TODO: does case matter?
    // TODO: should we parse out mime type?
    var contentType = this.getResponseHeader('Content-Type') || '';

    if(isContentTypeFeed(contentType)) {
      if(this.responseXML && this.responseXML.documentElement) {
        convertToFeed(this.responseXML);
      } else {
        onerror({type:'invalid-xml',target:this});
      }
    } else if(isContentTypeHTMLOrText(contentType)) {
      try {
        var xmlDocument = parseXML(this.responseText);
      } catch(e) {
        return onerror(e);
      }

      if(xmlDocument && xmlDocument.documentElement) {
        convertToFeed(xmlDocument);
      } else {
        onerror({type:'invalid-xml',target:this});
      }
    } else {
      onerror({type:'invalid-content-type',target:this});
    }
  }

  function convertToFeed(feedXML) {
    try {
      // TODO: this is wrong now, its
      var feed = createFeedFromXML(feedXML);
    } catch(e) {
      return onerror(e);
    }

    if(!feed.entries.length) {
      return oncomplete(feed);
    }

    var fetchableEntries = feed.entries.filter(entryHasLink);
    var numEntriesToProcess = fetchableEntries.length;
    if(numEntriesToProcess == 0) {
      return oncomplete(feed);
    }

    if(rewriteLinks) {
      fetchableEntries.forEach(rewriteEntryLink);
    }

    // In order to ensure consistent storage of entry.link values,
    // this check for whether to augment does not occur until after
    // entries with links have been possibly rewritten.
    if(!augmentEntries) {
      return oncomplete(feed);
    }

    // The following needs revision and just outright better design
    // We have some urls to fetch. But we don't want to fetch
    // for entries that are already stored in the database, sort of. It would
    // be nice to do things like retry later fetching.
    // TODO: this should be per feed, not across all entries, otherwise
    // if two feeds link to the same article, only the first gets augmented.
    // need to use something like findEntryByFeedIdAndLinkURL that uses
    // a compound index

    modelConnect(function(db) {
      fetchableEntries.forEach(function(entry) {
        findEntryByLinkURL(db, entry.link, function(existingEntry) {
          if(existingEntry) {
            dispatchIfComplete();
          } else {
            augmentEntry(entry);
          }
        });
      });
    });

    function augmentEntry(entry) {
      fetchHTMLDocument({
        augmentImageData: augmentImageData,
        url: entry.link,
        onload: function(doc) {
          var html = doc.body.innerHTML;
          if(html)
            entry.content = html;
          dispatchIfComplete();
        },
        onerror: function(error) {
          console.log(error);
          dispatchIfComplete();
        },
        timeout: entryTimeout
      });
    }

    function dispatchIfComplete() {
      if(--numEntriesToProcess == 0) {
        oncomplete(feed);
      }
    }
  }
}

/**
 * Fetches a webpage. Basically wraps an XMLHttpRequest.
 *
 *
 * TODO: should we notify the callback of responseURL (is it
 * the url after redirects or is it the same url passed in?). i think
 * the onload callback should also receive responseURL. maybe onerror
 * should also receive responseURL if it is defined. that way the caller
 * can choose to also replace the original url
 * TODO: consider support for a fallback to plaintext
 * and recharacterizing this as fetchHTMLOrPlaintextDocument or something.
 * TODO: could this pass the xhr along instead of HTMLDocument? it works in
 * the normal case because caller ust accesses responseXML, but what about
 * if we provide the plaintext fallback?
 * TODO: consider an option to embed iframe content
 * TODO: consider an option to auto-sandboxing iframes
 * Params is object with following properties
 * @param {string} url - the url to fetch
 * @param {function} onload - callback when completed without errors,
 * passed HTMLDocument object as only parameter
 * @param {function} onerror - callback when an error occurs that
 * prevents completion, such as abort, timeout, missing body tag, wrong content type
 * @param {integer} timeout - optional, ms
 * @param {boolean} augmentImageData - if true, will also fetch images
 * and store dimensions as html attributes.
 */
function fetchHTMLDocument(params) {
  var self = this;
  var request = new XMLHttpRequest();
  request.timeout = params.timeout;
  request.ontimeout = params.onerror;
  request.onerror = params.onerror;
  request.onabort = params.onerror;
  request.onload = onHTMLDocumentLoad;
  request.open('GET', params.url, true);
  request.responseType = 'document';
  request.send();

  function onHTMLDocumentLoad(event) {

    // TEMP: learning about responseURL
    if(this.responseURL != params.url) {
      console.log('originalURL %s responseURL %s', params.url, this.responseURL);
    }

    var contentType = this.getResponseHeader('content-type');
    if(isContentTypeHTML(contentType)) {
      if(this.responseXML && this.responseXML.body) {
        if(params.augmentImageData) {
          augmentImageData(this.responseXML, this.responseURL, params.onload);
        } else {
          params.onload(this.responseXML);
        }
      } else {
        params.onerror({type:'invalid-document',target:this});
      }
    } else {
      params.onerror({type:'invalid-content-type',target:this,contentType:contentType});
    }
  }
}

/**
 * Set dimensions for image elements that are missing dimensions.
 * Passes along the doc to oncomplete. Async.
 *
 * TODO: srcset, picture
 * TODO: could this just accept an xhr instead of doc + baseURL?
 * is that better or worse?
 *
 * @param doc {HTMLDocument} an HTMLDocument object to inspect
 * @param baseURL {string} for resolving image urls
 * @param oncomplete {function}
 */
function augmentImageData(doc, baseURL, oncomplete) {

  // Get an array of only loadable images
  var filter = Array.prototype.filter;
  var allBodyImages = doc.body.getElementsByTagName('img');
  var loadableImages = filter.call(allBodyImages, function(image) {
    var source = (image.getAttribute('src') || '').trim();
    return source && !image.width && !isDataURI(source);
  });

  var numImagesToLoad = loadableImages.length;

  if(!numImagesToLoad) {
    return oncomplete(doc);
  }

  loadableImages.forEach(function(image) {

    var source = (image.getAttribute('src') || '').trim();

    // TODO: we could parse baseURL only once
    if(baseURL) {
      image.setAttribute('src',resolveURI(parseURI(baseURL), parseURI(source)));
    }

    // Image may be alien (e.g. from responseXML), so import. Also,
    // because nothing happens when setting src of a element that
    // has never been attached to the live document.
    var localImage = document.importNode(image, false);
    localImage.onerror = dispatchIfComplete;
    localImage.onload = onload;

    // Prevent webkit from suppressing change
    var src = localImage.src;
    localImage.src = void src;
    localImage.src = src;

    function onload() {
      image.width = this.width;
      image.height = this.height;
      //console.log('W %s H %s', image.width, image.height);
      dispatchIfComplete();
    }
  });

  function dispatchIfComplete() {
    if(--numImagesToLoad == 0) {
      oncomplete(doc);
    }
  }
}

/**
 * Tests whether the contentType contains a feed-like mimetype. Not
 * very strict.
 *
 * Matches application/xml, text/xml, application/atom+xml,
 * application/rdf+xml, application/rss+xml.
 *
 * TODO: use reader.mime.isContentTypeFeed for this and similar
 * functions?
 *
 * @param contentType {string} the content type string to search, which
 * could be a full raw header string
 * @return {boolean} true if contentType contained a feed-like mime type
 */
function isContentTypeFeed(contentType) {
  return /(application|text)\/(atom|rdf|rss)?\+?xml/i.test(contentType);
}

/**
 * Tests whether contentType corresponds to text/html mime type.
 * The test is an informal regex. Content type could contain
 * a full header like text/html;encoding=UTF-8,
 * we just check if it contains 'text/html'. This is not intended
 * to be secure nor 100% accurate.
 *
 * Allows leading spaces, case-insensitive.
 *
 * @param contentType {string} the string to search
 * @return {boolean} true if is text/html mime type
 */
function isContentTypeHTML(contentType) {
  return /text\/html/i.test(contentType);
}

function isContentTypeText(contentType) {
  return /text\/plain/i.test(contentType);
}

/**
 * Tests whether contentType corresponds to text/plain mime type,
 * or the text/html type.
 *
 * TODO: i think i should deprecate this and force caller to
 * use 2 conditions? it means 2 regexes which is slower, but
 * it is looser coupling?
 *
 * @param contentType {string}
 * @return {boolean} true if text/plain
 */
function isContentTypeHTMLOrText(contentType) {
  return /text\/(plain|html)/i.test(contentType);
}

/**
 * Tests whether str is a data uri. Only intended to be good enough
 * to avoid issues such as trying to resolve or fetch data uris.
 *
 * NOTE: would be nice if we could check some property of the
 * element containing the url, but I could not find another
 * indicator. element.src always returns a DOMString.
 *
 * NOTE: https://gist.github.com/bgrins/6194623 is helpful
 * @param url {string} the url to test
 * @return {boolean} true if it looks like an object url
 */
function isDataURI(url) {
  return /^data:/i.test(url);
}

/**
 * Use Google's feed service to find feed URLs corresponding to a
 * google search query. Async.
 *
 * @param params {object} an object containing props:
 * - query {string} the text query to send to google, assumed defined
 * - oncomplete {function} the callback function to pass query and
 * entries, an array of entry objects from the Google JSON result
 * - onerror {function} the fallback function in case of an error
 * - timeout {integer} optional timeout before giving up, ms
 */
function discoverFeeds(params) {
  var oncomplete = params.oncomplete || noop;
  var onerror = params.onerror || noop;
  var query = (params.query || '').trim();
  var timeout = params.timeout || 0;

  // NIT: declare constants as properties of reader.fetch in uppercase?
  var baseURL = 'https://ajax.googleapis.com/ajax/services/feed/find';
  var apiVersion = '1.0';
  var requestURL = baseURL + '?v=' + apiVersion + '&q=' + encodeURIComponent(query);


  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;

  request.onload = function(event) {
    var data = this.response.responseData;
    data.entries.forEach(function(entry) {
      entry.contentSnippet = stripBRs(entry.contentSnippet);
    });
    oncomplete(data.query, data.entries);
  };

  //console.log('discoverFeeds requestURL %s', requestURL);

  request.open('GET', requestURL, true);
  request.responseType = 'json';
  request.send();
}

/**
 * Returns a URL string pointing to the fav icon for a url. If url is
 * undefined/empty, the locally stored default fav icon url is returned
 * instead.
 *
 * NOTE: chrome://favicons/url only works for urls present in
 * history, so it is useless.
 * TODO: this should be using a callback, to allow for more seamless
 * transition to async service call.
 * TODO: support offline. right now this returns a remote url which
 * then causes images to not load later if offline.
 * TODO: this is should be refactored to look more like a wrapper call
 * to a service from which urls are fetched. After all this is partly
 * why this function is put in the fetch namespace.
 * TODO: does it matter whether we use http or https?
 * TODO: does fetching involve CORS issues or need to change manifest
 * or similar issues? If I ever want to stop using all_urls, the
 * URLs used here would maybe need to be explicit in manifest?
 *
 * @param url {string} the url of a webpage for which to find the
 * corresponding fav icon.
 * @return {string} the url of the favicon
 */
function getFavIconURL(url) {
  var GOOGLE_BASE_URL = 'http://www.google.com/s2/favicons?domain_url=';
  var FALLBACK_URL = '/media/rss_icon_trans.gif';
  return url ?  GOOGLE_BASE_URL + encodeURIComponent(url) : FALLBACK_URL;
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

/*************** URL REWRITING ***************************************
 * TODO: model after apache mod_rewrite
 */

/**
 * Returns a rewritten url, or the original url if no rewriting rules were applicable.
 *
 * NOTE: I tore apart all the old rewriting code because I decided that its too
 * confusing of a feature for users to configure rewriting rules, and that it was
 * better to just hardcode in some known proxies.
 */
function rewriteURL(url) {
  var reGoogleNews = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  var matches = reGoogleNews.exec(url);
  if(matches && matches.length == 2 && matches[1]) {
    var newURL = decodeURIComponent(matches[1]);
    //console.log('rewrote %s as %s', url, newURL);

    // NOTE: we know it is not empty
    return newURL;
  }

  return url;
}

function isRewritingEnabled() {
  return localStorage.URL_REWRITING_ENABLED;
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


/*************** CONTENT FILTER FUNCTIONS ****************************
 * TODO: this should maintain its own state by saving
 * an array of rules in memory, instead of having caller
 * pass around a rules array.
 * TODO: comments
 * TODO: update dependencies
 */

function convertContentFilterToRegex(query) {
  // Escape regexp chars (except *) and then replace * with .*
  return query.replace(/[-[\]{}()+?.\\^$|#\s]/g,'\\$&').replace(/\*+/g,'.*');
}

function translateContentFilterRule(rule) {
  if(rule.match) {
    var pattern = convertContentFilterToRegex(rule.match);

    // Recreate the regular expression object as set as
    // the property 're'
    rule.re = new RegExp(pattern, 'i');
  }
}

function loadContentFilterRules() {
  var str = localStorage.CONTENT_FILTERS;
  if(!str) return [];
  var obj = JSON.parse(str);
  obj.rules.forEach(translateContentFilterRule);
  return obj.rules;
}

function saveContentFilterRules(rules) {
  localStorage.CONTENT_FILTERS = JSON.stringify({rules: rules || []});
}

function areContentFilterRulesEqual(rule1, rule2) {
  if(rule1.id && rule2.id)
    return rule1.id == rule2.id;
  return rule1.tag === rule2.tag && rule1.attr === rule2.attr &&
    rule1.match === rule2.match;
}

function getContentFilterRuleId(rule) {
  return rule.id;
}

function generateContentFilterId(rules) {
  var ids = rules.map(getContentFilterRuleId);
  var max = arrayMax(ids);
  return (!max || max < 1) ? 1 : (max + 1);
}

function createContentFilterRule(tag, attr, match) {
  var rules = loadContentFilterRules();

  var rule = {
    id: generateContentFilterId(rules),
    tag: tag,
    attr: attr,
    match: match
  };

  rules.push(rule);
  saveContentFilterRules(rules);
  return rule;
}

function removeContentFilterRule(ruleId) {
  var rules = loadContentFilterRules();
  var differentRuleId = function(rule) {
    return rule.id != ruleId;
  };

  var newRules = rules.filter(differentRuleId);
  saveContentFilterRules(newRules);
  return ruleId;
}

function contentFilterRuleToString(rule) {
  var s = '<';
  s += rule.tag ? rule.tag : 'any-tag';
  s += ' ';

  if(rule.attr) {
    s += rule.attr;
    if(rule.match) {
      s += '="' + rule.match + '"';
    }
  } else if(rule.match) {
    s += 'any-attribute="' + rule.match + '"'
  }

  s += rule.tag ? '></' + rule.tag + '>' : '/>';
  return s;
}

/************************ CALAMINE ********************************
 * sanitizer like function, I plan to break apart some of it
 * because it was growing to big, overlapped with old sanitizer func, etc
 * Actually it is so huge I am leaving it separate for now
 */


/************************ SANITIZER FUNCTIONALITY ********************************
 * NOTE: broke apart sanitzer module into these functions
 * NOTE: might integrate with calamine functions
 */

/**
 * NOTE: replaced evaluateRule in sanitizer
 */
function testContentFilterRuleMatchesNode(rule, node) {
  if(rule.tag && rule.re && rule.tag.toLowerCase() == node.localName.toLowerCase()) {
    var attr = node.getAttribute(rule.attr);
    if(attr) {
      return rule.re.test(attr);
    }
  }
}

/**
 * NOTE: returns true means keep, return false means remove it
 * TODO: refactor
 */
function applyContentFilterRulesToNode(node, rules) {

  if(!localStorage.ENABLE_CONTENT_FILTERS) {
    return 1;
  }

  var matched = any(rules, function(rule) {
    return testContentFilterRuleMatchesNode(rule, node);
  });

  // 0 = remove, 1 = retain
  return matched ? 0 : 1;
}


function sanitizeAnchor(element) {


  var href = element.getAttribute('href');
  if(!href) {
    return unwrapElement(element);
  }

  // Scrub javascript urls
  if(/^javascript:/i.test(href)) {
    return unwrapElement(element);
  }

  // TODO: resolve

  // TODO: should be using a link handler to do this
  // this is a deprecated way of forcing new window. Also it
  // will be easier to make it a customizable preference if the
  // click handler can determine it later.
  node.setAttribute('target','_blank');
}

function sanitizeEmbed(element) {
  var src = node.getAttribute('src');
  if(src) {
    var srcURI = URI.parse(src.trim());

    // Rewrite youtube embeds to always use https so
    // as to comply with our CSP
    if(srcURI && srcURI.host && srcURI.scheme != 'https' &&
      srcURI.host.indexOf('www.youtube.com') == 0) {
      srcURI.scheme = 'https';

      node.setAttribute('src', URI.toString(srcURI));
    }
  }
}



// From sanitizer, needs refactoring
function resolveRelativeURLNode = function(node, base) {

  // No point in doing anything without a base uri
  if(!base) {
    return;
  }

  // TODO: maybe clean this up a bit to clarify which tags
  // use src and which use href. Maybe a function like
  // getURLAttributeForNode(node).
  var attributeName = node.matches('a') ? 'href' : 'src';
  var source = node.getAttribute(attributeName);

  // Cannot resolve nodes without an attribute containing a URL
  if(!source) {
    return;
  }

  var uri = parseURI(source);

  // Do not try and resolve absolute URLs
  if(uri.scheme) {
    return;
  }

  node.setAttribute(attributeName, resolveURI(base, uri));
}

// elements with resolvable attributes (href/src)
var SELECTOR_RESOLVABLE = 'a,applet,audio,embed,iframe,img,object,video';

// TODO: add a not href
var SELECTOR_UNWRAPPABLE = 'article,center,details,div,font,help,insert,'+
  'label,nobr,noscript,section,span,st1';

// from sanitizer
var SELECTOR_BLACKLIST = 'base:1,basefont,command,datalist,dialog,'+
  'fieldset,frame,frameset,html,input,legend,link,math,meta,noframes,'+
  'option,optgroup,output,script,select,style,title,iframe';

var SELECTOR_WHITELIST = 'a,abbr,acronym,address,applet,'+
'area,article,aside,audio,b,base,basefont,bdi,bdo,big,'+
'br,blockquote,canvas,caption,center,cite,code,col,colgroup,'+
'command,data,datalist,details,dialog,dir,dd,del,dfn,div,'+
'dl,dt,em,embed,entry,fieldset,figcaption,figure,font,'+
'footer,frame,frameset,header,help,hgroup,hr,h1,h2,h3,'+
'h4,h5,h6,html,i,iframe,img,input,ins,insert,inset,'+
'label,legend,li,link,kbd,main,mark,map,math,meta,'+
'meter,nav,nobr,noframes,noscript,ol,object,option,'+
'optgroup,output,p,param,pre,progress,q,rp,rt,ruby,s,'+
'samp,script,section,select,small,span,strike,strong,style,'+
'st1,sub,summary,sup,vg,table,tbody,td,tfood,th,thead,time,'+
'title,tr,track,tt,u,ul,var,video,wbr';

// Based on https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js
var BOOLEAN_ATTRIBUTES = {
  allowfullscreen:1,async:1,autofocus:1,autoplay:1,checked:1,compact:1,controls:1,
  declare:1,'default':1,defaultchecked:1,defaultmuted:1,defaultselected:1,
  defer:1,disable:1,draggable:1,enabled:1,formnovalidate:1,hidden:1,
  indeterminate:1,inert:1,ismap:1,itemscope:1,loop:1,multiple:1,muted:1,
  nohref:1,noresize:1,noshade:1,novalidate:1,nowrap:1,open:1,pauseonexit:1,
  readonly:1,required:1,reversed:1,scoped:1,seamless:1,selected:1,
  sortable:1,spellcheck:1,translate:1,truespeed:1,typemustmatch:1,
  visible:1
};

/**
 * Removes leading and trailing whitespace nodes from an HTMLDocument
 * The doc object itself is modified in place, no return value.
 * Note: we only traverse the first level of the DOM hiearchy
 */
function trimDocument(doc) {
  // Trim leading
  var node = doc.firstChild, sibling;
  while(node && isTrimmableNode(node)) {
    sibling = node.nextSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }

  // Trim trailing
  node = doc.lastChild;
  while(node && isTrimmableNode(node)) {
    sibling = node.previousSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }
}


/**
 *  Returns true if the node is trimmable. Note
 * side effect it will trim text nodes (not quite right)
 */
function isTrimmableNode(node) {

  // Trim comments
  if(node.nodeType == Node.COMMENT_NODE) {
    return true;
  }

  // Trim empty text nodes.
  if(node.nodeType == Node.TEXT_NODE) {
    node.textContent = node.textContent.trim();
    if(node.textContent.length == 0) {
      return true;
    }
  }

  if(node.matches && node.matches('br')) {
    return true;
  }

  // Trim empty paragraphs.
  if(node.matches && node.matches('p')) {
    // This works for several cases. For it to be really accurate we would have
    // to something like a DFS that trims while backtracking over a set of allowed
    // child tags. Those situations are probably more rare and it is for only a small
    // benefit so this is probably sufficient.

    // TODO: consider &nbsp; and other whitespace entities. We are not at this
    // point sanitizing those. <p>&nbsp;</p> is a thing.

    // Note: consider childElementCount instead of childNodes.length. Although it might
    // be different here? Need to test the differences.

    if(node.childNodes.length == 0) {
      // <p></p>
      return true;
    } else if(node.childNodes.length == 1 && node.firstChild.nodeType == Node.TEXT_NODE &&
      node.firstChild.textContent.trim().length == 0) {
      // <p>whitespace</p>
      return true;
    }
  }
};


/************************ FEED IMPORT FUNCTIONALITY ********************************
 * TODO: refactor as a part of change to backend.js, add comments
 */

/**
 * Async.
 *
 * @param files a FileList object
 * @param callback called when completed
 */
function importOPMLFiles(files, callback) {

  if(!files || !files.length) {
    callback();
    return;
  }

  var fileCounter = files.length, exceptions = [], feedsHash = {};

  var aggregateByURL = function(feed) {
    if(feed.url) feedsHash[feed.url] = feed;
  };

  var onFileLoad = function(event) {
    try {
      var parsedFeeds = parseOPMLString(event.target.result);
      parsedFeeds.forEach(aggregateByURL);
    } catch(exception) {
      exceptions.push(exception);
    }

    if(--fileCounter == 0) {
      importFeeds(values(feedsHash), exceptions, callback);
    }
  };

  each(files, function(file) {
    var reader = new FileReader();
    reader.onload = onFileLoad;
    reader.readAsText(file);
  });
}

function importFeeds(feeds, exceptions, callback) {
  var feedsProcessed = 0, feedsAdded = 0;
  callback = callback || function(){};

  if(!feeds || !feeds.length) {
    console.log('no feeds to import');
    console.dir(exceptions);
    callback(feedsAdded, feedsProcessed, exceptions);
    return;
  }

  var params = {};
  params.onerror = onSuccessOrError;
  params.oncomplete = function() {
    feedsAdded++;
    onSuccessOrError();
  };

  var onSuccessOrError = function() {
    feedsProcessed++;
    if(feedsProcessed >= feeds.length) {
      console.log('Imported %s of %s feeds with %s exceptions',
        feedsAdded, feeds.length, exceptions.length);
      callback(feedsAdded, feeds.length, exceptions);
    }
  };

  openDB(function(db) {
    // TODO: this is out of date
    // Pack in an open db conn so subscriptions.add
    // can reuse it per call.
    params.db = db;
    feeds.forEach(function(feed) {
      params.url = feed.url ? feed.url.trim() : '';
      if(params.url) {
        addSubscription(params);
      }
    });
  });
}



/************************** EFFECTS **************************
 * Fade an element in/out
 * Elements must have opacity defined as 0 or 1 for this to work
 * TODO: this needs to be entirely refactored
 */
function fadeElement(element, duration, delay, callback) {

  if(element.style.display == 'none') {
    element.style.display = '';
    element.style.opacity = '0';
  }

  if(!element.style.opacity) {
    element.style.opacity = element.style.display == 'none' ? '0' : '1';
  }

  if(callback) {
    element.addEventListener('webkitTransitionEnd', webkitTransitionEndEventListener);
  }

  // element duration function delay
  element.style.transition = 'opacity '+duration+'s ease '+delay+'s';
  element.style.opacity = element.style.opacity == '1' ? '0' : '1';

  function webkitTransitionEndEventListener(event) {
    this.removeEventListener('webkitTransitionEnd', webkitTransitionEndEventListener);
    callback(element);
  }
}

/*************** URI **************************
 * TODO: look at how node.js did URI
 */

// Parse a string into a URI
function parseURI(str) {
  if(str) {
    var m = str.match(/^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/);
    var r = {};
    if(m[1]) r.scheme = m[1];
    if(m[2]) r.host = m[2];
    if(m[3]) r.path = m[3];
    if(m[4]) r.query = m[4];
    if(m[5]) r.fragment = m[5];
    return r;
  }
}

// Convert URI to string representation
function toStringURI(obj) {
  if(obj) {
    var s = '';
    if(obj.scheme) s = obj.scheme + '://';
    if(obj.host) s += obj.host;
    if(obj.path) s += obj.path;
    if(obj.query) s += '?' + obj.query;
    if(obj.fragment) s += '#' + obj.fragment;
    return s;
  }
}

// Convert a relative URI to an absolute URI string
// TODO: return a URI object, let the caller decide what to do with it
function resolveURI(base,path) {
  if(base && path) {
    if(!path.scheme) path.scheme = base.scheme;
    if(!path.host) path.host = base.host;
    return toStringURI(path);
  }
}

// Extremely basic URL validition
function isValidURI(obj) {
  if(obj) {
    // If there is no scheme, URI.parse shoves host into path,
    // which is sort of a bug. Treat path as the host
    var host = obj.scheme ? obj.host : obj.path;

    return host && host.indexOf('.') > 0 && host.indexOf(' ') == -1;
  }
}

function isValidURIString(str) {
  return isValidURI(parseURI(str));
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

xml2json.rdf2json = function(doc) {
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
};

function setIfNotEmpty(obj, key, value) {
  if(value) {
    obj[key] = value;
  }
}

// Searches in selector order, not document order
function findText(element, selectors, attribute) {

  var node, text, result;

  selectors.forEach(function(selector) {
    if(result) return;
    node = element.querySelector(selector);
    if(node) {

      // If attribute is specified, we get the value of the attribute
      // instead of the node's textContent

      text = attribute ? node.getAttribute(attribute) : node.textContent;
      if(text) {
        text = text.trim();
        if(text.length) {
          result = text;
        }
      }
    }
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


/************* OPML FUNCTIONS ******************************************
 * TODO: refactor
 */

function createOPMLDocument(feeds, titleValue) {

  var doc = document.implementation.createDocument(null, null);

  var elementOPML = doc.createElement('opml');
  elementOPML.setAttribute('version', '2.0');
  doc.appendChild(elementOPML);

  var head = doc.createElement('head');
  elementOPML.appendChild(head);

  var title = doc.createElement('title');
  title.textContent = titleValue || 'subscriptions.xml';
  head.appendChild(title);

  var dateNow = new Date();
  var rfc822DateString = dateNow.toUTCString();

  var dateCreated = doc.createElement('dateCreated');
  dateCreated.textContent = rfc822DateString;
  head.appendChild(dateCreated);

  var dateModified = doc.createElement('dateModified');
  dateModified.textContent = rfc822DateString;
  head.appendChild(dateModified);

  var elementDocs = doc.createElement('docs');
  elementDocs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(elementDocs);

  var body = doc.createElement('body');
  elementOPML.appendChild(body);

  (feeds || []).forEach(function(feed) {

    if(!feed.title || !feed.url)
      return;

    var outline = doc.createElement('outline');
    outline.setAttribute('type', 'rss');

    var title = stripControls(feed.title);
    outline.setAttribute('text', title);
    outline.setAttribute('title', title);
    outline.setAttribute('xmlUrl', feed.url);

    if(feed.description)
      outline.setAttribute('description', stripControls(stripTags(feed.description||'','')));

    if(feed.link)
        outline.setAttribute('htmlUrl', feed.link);

    body.appendChild(outline);
  });

  return doc;
}

function parseOPMLFromString(str) {
  var xmlDocument = parseXML(str);
  return parseOPMLDocument(xmlDocument);
}

/**
 * TODO: rename, we are not parsing here, we are coercing or something
 * TODO: use getElementsByTagName instead of $$ which is querySelectorAll
 * because we are reading, not writing
 */
function parseOPMLDocument(xmlDocument) {

  var outlineNodes, feedOutlineNodes;

  if(xmlDocument && xmlDocument.documentElement &&
    xmlDocument.documentElement.localName == 'opml') {

    outlineNodes = $$('outline', xmlDocument);
    feedOutlineNodes = filter(outlineNodes, isOPMLNodeTypeFeed);
    return feedOutlineNodes.map(coerceOPMLOutline);

  } else {
    return [];
  }
}

/**
 * TODO: again, choose a more appropriate name for this
 */
function coerceOPMLOutline(node) {
  return {
    title: node.getAttribute('title') || node.getAttribute('text'),
    description: stripTags(stripControls(node.getAttribute('description'))),
    url: stripControls(node.getAttribute('xmlUrl')),
    link: stripControls(node.getAttribute('htmlUrl'))
  };
}

function isOPMLNodeTypeFeed(node) {
  var type = node.getAttribute('type');
  return /rss|rdf|feed/i.test(type);
}



/************* STORAGE RELATED FUNCTIONS *******************************
 * TODO: needs refactoring
 */

// Connect to indexedDB
function openDB(callback) {
  var request = indexedDB.open('reader', 9);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onupgradeneeded = onDBUpgradeNeeded;
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
}

/**
 * Changes from version 0 to 7 were not recorded, no longer important
 * Changes from old version 6 to version 7 added the title index to
 * feed store for sorting by title
 * Changes from old version 7 to version 8 drop the store.url index
 * and added the store.schemeless index. The url index was used to
 * check if a feed already existed when subscribing. The new schemeless
 * index serves the same purpose but is based on a property where the URLs
 * scheme is not stored.
 * Changes from 8 to 9: adding link index to entry store. the link index
 * is used to check if the article has already been downloaded.
 *
 * Note: ideally we would never store both schemeless and url, we would just
 * store scheme and schemeless props as parts of the url property. Consider
 * making this change at some point prior to release when I dont mind deleting
 * the test data.
 *
 * Every single branch below needs to bring that old version all the way to the
 * current version. This is because the user could be affected by an upgrade
 * that bumps them several versions at once.
 */

function onDBUpgradeNeeded(event) {
  var db = event.target.result;

  console.log('Upgrading database from %s to %s',
    event.oldVersion, model.DATABASE_VERSION);

  if(event.oldVersion == 0) {
    // TODO: this branch needs testing again
    // - is the initial version 0 or 1????

    //console.log('Setting up database for first time');

    //console.log('Creating feed store');
    var feedStore = db.createObjectStore('feed', {keyPath:'id',autoIncrement:true});

    // For checking if already subscribed
    // No longer in use, use schemeless instead
    //feedStore.createIndex('url','url',{unique:true});

    feedStore.createIndex('schemeless','schemeless',{unique:true});

    // For loading feeds in alphabetical order
    feedStore.createIndex('title','title');

    //console.log('Create entry store');
    var entryStore = db.createObjectStore('entry', {keyPath:'id',autoIncrement:true});

    // For quickly counting unread
    // and for iterating over unread in id order
    entryStore.createIndex('unread','unread');

    // For quickly deleting entries when unsubscribing
    entryStore.createIndex('feed','feed');

    // For quickly checking whether a similar entry exists
    entryStore.createIndex('hash','hash');

    // For checking if URL fetched
    entryStore.createIndex('link','link');

  } else if(event.oldVersion == 6) {
    //console.log('Upgrading database from %s', event.oldVersion);
    var tx = event.currentTarget.transaction;

    var feedStore = tx.objectStore('feed');

    // Add the title index
    feedStore.createIndex('title','title');

    // Delete the url index (deprecated, using schemeless instead)
    feedStore.deleteIndex('url');

    // Add the schemeless index
    feedStore.createIndex('schemeless','schemeless',{unique:true});

    var entryStore = tx.objectStore('entry');

    entryStore.createIndex('link','link');

  } else if(event.oldVersion == 7) {

    var tx = event.currentTarget.transaction;
    var feedStore = tx.objectStore('feed');

    // Delete the url index (deprecated, using schemeless instead)
    feedStore.deleteIndex('url');

    // Add the schemeless index
    feedStore.createIndex('schemeless','schemeless',{unique:true});

    var entryStore = tx.objectStore('entry');
    entryStore.createIndex('link','link');

  } else if(event.oldVersion == 8) {

    var tx = event.currentTarget.transaction;
    var entryStore = tx.objectStore('entry');

    entryStore.createIndex('link','link');

  } else {
    console.error('Unhandled database upgrade, old version was %s', event.oldVersion);
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


/**
 * async
 */
function findEntryByLinkURL(db, url, callback) {
  var linkIndex = db.transaction('entry').objectStore('entry').index('link');
  linkIndex.get(url).onsuccess = function() {
    callback(this.result);
  };
}


/************** STYLING ***************************
 * Managing some CSS rules in javascript for customizing
 * the display of content
 */

var BACKGROUND_IMAGES = [
  //http://www.desktopwallpapers4.me/abstract/leather-texture-21220/
  '/media/abstract-leather-texture.jpg',

  '/media/bgfons-paper_texture318.jpg',
  '/media/bone-yellow-1.jpg',
  '/media/CCXXXXXXI_by_aqueous.jpg',
  '/media/designova-subtle-carbon.png',
  '/media/dominik-kiss-grid.png',
  '/media/krisp-designs-vertical-cloth.png',
  '/media/paper-backgrounds-vintage-white.jpg',
  '/media/papertank-black-padded-diamond.png',
  '/media/pickering-texturetastic-gray.png',
  '/media/reusage-recycled-paper-white-first.png',
  '/media/recycled_paper_texture.jpg',

  //http://seamless-pixels.blogspot.com/p/free-seamless-ground-textures.html
  '/media/slodive-canvas-texture-paper.jpg',
  '/media/subtle-patterns-beige-paper.png',
  '/media/subtle-patterns-black-paper.png',
  '/media/subtle-patterns-brickwall.png',
  '/media/subtle-patterns-cream-paper.png',
  '/media/subtle-patterns-exclusive-paper.png',
  '/media/subtle-patterns-extra-clean-paper.png',
  '/media/subtle-patterns-groove-paper.png',
  '/media/subtle-patterns-handmade-paper.png',
  '/media/subtle-patterns-noisy-net.png',
  '/media/subtle-patterns-paper-1.png',
  '/media/subtle-patterns-paper-2.png',
  '/media/subtle-patterns-paper.png',
  '/media/subtle-patterns-rice-paper-2.png',
  '/media/subtle-patterns-rice-paper-3.png',
  '/media/subtle-patterns-sand-paper.png',
  '/media/subtle-patterns-soft-wallpaper.png',
  '/media/subtle-patterns-white-wall.png',
  '/media/subtle-patterns-witewall-3.png',
  '/media/tabor-classy-fabric.png',
  '/media/texturemate-4097.jpg',
  '/media/thomas-zucx-noise-lines.png',

  // http://background-pictures.vidzshare.net
  '/media/towel-white-free-background.jpg'
];

var FONT_FAMILIES = [
  'ArchivoNarrow-Regular',
  'Arial, sans-serif',
  'Calibri',
  'Calibri Light',

  'Cambria',

  'CartoGothicStd',

  //http://jaydorsey.com/free-traffic-font/
  //Clearly Different is released under the SIL Open Font License (OFL) 1.1.
  //Based on http://mutcd.fhwa.dot.gov/pdfs/clearviewspacingia5.pdf
  'Clearly Different',

  // Downloaded free font from fontpalace.com, unknown author
  'FeltTip',

  'Georgia',

  'MS Sans Serif',
  'News Cycle, sans-serif',
  'Open Sans Regular',

  'PathwayGothicOne',

  'PlayfairDisplaySC',

  'Raleway, sans-serif'
];

function findCSSRule(selectorText) {
  var matchingRule;

  // We are always using styleSheets[0], so we can cheat here
  var sheet = document.styleSheets[0];
  until(sheet.rules, function(rule) {
    if(rule.selectorText == selectorText) {
      matchingRule = rule;
      return false;
    }
    return true;
  });
  return matchingRule;
}

function applyEntryStylesOnchange() {
  // Find the existing rules and modify them in place

  //console.log('applying styles');

  var entryRule = findCSSRule('div.entry');
  if(entryRule) {
    //console.log('found div.entry');
    if(localStorage.BACKGROUND_IMAGE) {
      entryRule.style.backgroundColor = '';
      entryRule.style.backgroundImage = 'url(' + localStorage.BACKGROUND_IMAGE + ')';
    } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
      entryRule.style.backgroundColor = localStorage.ENTRY_BACKGROUND_COLOR;
      entryRule.style.backgroundImage = '';
    } else {
      entryRule.style.backgroundColor = '';
      entryRule.style.backgroundImage = '';
    }
  } else {
    console.log('did not find div.entry');
  }

  var titleRule = findCSSRule('div.entry a.entry-title');
  if(titleRule) {
    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    titleRule.style.fontSize = localStorage.HEADER_FONT_SIZE;
  }

  var contentRule = findCSSRule('div.entry span.entry-content');
  if(contentRule) {
    contentRule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';
    contentRule.style.fontSize = localStorage.BODY_FONT_SIZE || '100%';
    contentRule.style.textAlign = (localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left';
    contentRule.style.lineHeight = localStorage.BODY_LINE_HEIGHT || 'normal';
  }
}

function applyEntryStylesOnload() {
  var sheet = document.styleSheets[0];

  var s = '';
  if(localStorage.BACKGROUND_IMAGE) {
    s += 'background: url('+ localStorage.BACKGROUND_IMAGE  +');';
  } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
    s += 'background:'+ localStorage.ENTRY_BACKGROUND_COLOR+';';
  }

  s += 'margin-left: 0px;margin-right: 0px; margin-bottom: 0px; margin-top:0px;';
  s += 'padding-top: 12px;';
  s += 'padding-left:12px;';
  s += 'padding-right:12px;';
  //s += 'padding-bottom:160px;';
  s += 'padding-bottom:20px;';
  sheet.addRule('div.entry',s);

  s =  'font-size:'+ (localStorage.HEADER_FONT_SIZE || '') +';';
  s += 'font-family:'+ (localStorage.HEADER_FONT_FAMILY || '')  +';';
  s += 'letter-spacing: -0.03em;';
  s += 'color: rgba(50, 50, 50, 0.9);';
  s += 'padding: 0px 0px 0px 0px;';
  s += 'margin-bottom:12px;';
  s += 'margin-left:0px;';
  s += 'text-decoration:none;';
  s += 'display:block;';
  s += 'word-wrap: break-word;';
  s += 'text-shadow: 1px 1px 2px #cccccc;';
  s += 'text-transform: capitalize;';
  //s += 'text-align:justify;';
  sheet.addRule('div.entry a.entry-title', s);

  s =  'font-size: '+ (localStorage.BODY_FONT_SIZE || '')+';';
  s += 'text-align: '+ ((localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left')+';';
  s += 'font-family:'+ (localStorage.BODY_FONT_FAMILY || '')  +';';
  s += 'line-height:'+(localStorage.BODY_LINE_HEIGHT || 'normal')+';';
  s += 'vertical-align:text-top;';
  //s += 'letter-spacing: -0.03em;';
  //s += 'word-spacing: -0.5em;';
  s += 'display:block;';
  s += 'word-wrap: break-word;';
  s += 'padding-top:0px;';
  s += 'padding-right: 10px;';
  s += 'margin: 0px;';

  // TODO: use this if columns enabled (use 1(none), 2, 3 as options).
  s += '-webkit-column-count: 2;';
  s += '-webkit-column-gap: 30px;';
  s += '-webkit-column-rule:1px outset #cccccc;';

  sheet.addRule('div.entry span.entry-content', s);
}


/************** MISC ***************************
 * From utilities
 */

if(typeof $ == 'undefined') {
  window.$ = function(selector,doc) {
    return (doc || document).querySelector(selector);
  };
}

if(typeof $$ == 'undefined') {
  window.$$ = function(selector,doc) {
    return (doc || document).querySelectorAll(selector);
  };
}

function noop() {}

/**
 * Copies properties from src (specific to src) to
 * target.
 */
function extend(target,src) {
  for(var key in src) {
    if(src.hasOwnProperty(key)) {
      target[key] = src[key];
    }
  }
  return target;
}

function updateBadge() {
  model.connect(function(db) {
    db.transaction('entry').objectStore('entry').index('unread').count(
      IDBKeyRange.only(model.UNREAD)).onsuccess = function(event) {
      var count = event.target.result || 0;
      chrome.browserAction.setBadgeText({text: count.toString()});
    };
  });
}

function showNotification(message) {
  var manifest = chrome.runtime.getManifest();
  var options = {
    type:'basic',
    title: manifest.name || 'Untitled',
    iconUrl:'rss_icon_trans.gif',
    message:message
  };

  chrome.permissions.contains({permissions: ['notifications']}, function(permitted) {
    if(permitted) {
      chrome.notifications.create('honeybadger', options, function() {});
    }
  });
}

/**
 * Refactor to allow thisArg
 */
function each(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len;
    func(obj[i++])) {
  }
}

function reverseEach(obj, func) {
  var i = obj.length;
  while(i--) {
    func(obj[i]);
  }
}

function filter(obj, func) {
  return Array.prototype.filter.call(obj, func);
}

// Deprecate in favor of inverted [].some?
function until (obj, func) {
  for(var i = 0, len = obj ? obj.length : 0, continues = 1;
    continues && i < len; continues = func(obj[i++])) {
  }
}

function until2(obj, func) {
  return Array.prototype.some.call(obj, function(val) {
    return !func(val);
  });
}

// Deprecate in favor of [].some
function any(obj, func) {
  return Array.prototype.some.call(obj, func);
}

// TODO: finish args
function toArray = function(obj) {
  return Array.prototype.slice.call(obj);
}


function values(obj) {
  var arr = [];
  Object.getOwnPropertyNames(obj).forEach(function(key) {
    arr.push(obj[key]);
  });
  return arr;
}

// Finds the highest number in an array of unsigned longs
// Adapted from http://stackoverflow.com/questions/11190407
function arrayMax(arr) {
  if(arr && arr.length) {
    return arr.reduce(function(max, currentValue) {
      return Math.max(max, currentValue);
    }, -Infinity);
  }
}

// Extremely simple date formatting
function formatDate(date, sep) {
  return date?
    [date.getMonth() + 1, date.getDate(), date.getFullYear()].join(sep || '-') :
    '';
}

// Extremely simple date parsing.
function parseDate(str) {
  if(!str) {
    return;
  }

  var date = new Date(str);

  if(Object.prototype.toString.call(date) != '[object Date]') {
    return;
  }

  if(!isFinite(date)) {
    return;
  }

  return date;
}

function stripControls(str) {
  if(str) return str.replace(/[\t\r\n]/g,'');
}

// Returns true if str1 starts with str2
function startsWith(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
}

// Truncates a string
function truncate(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
}

/**
 * Strip HTML tags from a string
 * Replacement is an optional parameter, string, that is included
 * in the place of tags. Specifying a replacement works
 * considerably slower and may differ in behavior.
 */
function stripTags(str, replacement) {
  if(str) {
    var doc = parseHTML(str);
    if(replacement) {
      var it = doc.createNodeIterator(doc, NodeFilter.SHOW_TEXT),
        node, textNodes = [];
      while(node = it.nextNode()) {
        textNodes.push(node.data);
      }

      return textNodes.join(replacement);
    }

    return doc.textContent;
  }
}

/**
 * Quick and dirty string replacement of <br>
 */
function stripBRs(str) {
  if(str) {
    return str.replace(/<br>/gi,'');
  }
}

function parseHTML = function(str) {
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;
  return doc.body;
}

function parseXML(str) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(str, 'application/xml');

  var errorElement = $('parsererror',doc);
  if(errorElement) {
    if(errorElement.firstChild && errorElement.firstChild.nextSibling) {
      throw errorElement.firstChild.nextSibling.textContent;
    }
    throw errorElement.textContent;
  }

  return doc;
}

// Generate a simple hashcode from a character array
function generateHashCode(arr) {
  if(arr && arr.length) {
    return arr.reduce(function (previousValue, currentValue) {
      return (previousValue * 31 + currentValue.charCodeAt(0)) % 4294967296;
    }, 0);
  }
}

/**
 * TODO: deprecate, use element.matches
 */
function isAnchor(element) {
  return element && element.__proto__ == HTMLAnchorElement.prototype;
}

/**
 * TODO: deprecat
 */
function isImage(element) {
  return element && element.__proto__ == HTMLImageElement.prototype;
}

function getSchemelessURL(url) {
  var schemeless = URI.parse(url);
  if(schemeless) {
    delete schemeless.scheme;
    return URI.toString(schemeless);
  }
}

/**
 * TODO: rename, clarify. is this used?
 */
var KEY = {
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  N: 78,
  P: 80
};


var scrollYStartTimer, scrollYIntervalTimer;
function smoothScrollToY(element, delta, targetY) {
  clearTimeout(scrollYStartTimer);
  clearInterval(scrollYIntervalTimer);

  var start = function() {
    scrollYIntervalTimer = setInterval(scrollY,20);
  };

  var scrollY = function() {
    var currentY = element.scrollTop;
    element.scrollTop += delta;
    if(currentY == element.scrollTop || element.scrollTop == targetY) {
      clearInterval(scrollYIntervalTimer);
    }
  };

  scrollYStartTimer = setTimeout(start,5);
}