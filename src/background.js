// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class Background {

  // TODO: maybe set the badge text to '?'
  // TODO: set localStorage defaults
  static onInstalled(event) {
    Database.open(function(event) {
      // NOOP
    });
  }

  static onAlarm(alarm) {
    if(alarm.name === 'archive') {
      Background.archiveEntries();
    } else if(alarm.name === 'poll') {
      Background.pollFeeds();
    }
  }

  // TODO: whether to reuse the newtab page should possibly be a setting that
  // is disabled by default, so this should be checking if that setting is
  // enabled before querying for the new tab.
  // NOTE: the calls to chrome.tabs here do not require the tabs permission
  // TODO: is the trailing slash necessary for new tab?
  static onBadgeClick() {
    chrome.tabs.query({
      'url': chrome.extension.getURL('slides.html')
    }, Background.onQueryTabsForView);
  }

  static onQueryTabsForView(tabs) {
    const viewURL = chrome.extension.getURL('slides.html');
    const newTabURL = 'chrome://newtab/';
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active: true});
    } else {
      chrome.tabs.query({url: newTabURL}, onQueryNewTab);
    }

    function onQueryNewTab(tabs) {
      if(tabs.length) {
        chrome.tabs.update(tabs[0].id, {active:true, url: viewURL});
      } else {
        chrome.tabs.create({url: viewURL});
      }
    }
  }

  // TODO: customizable update schedules per feed
  // TODO: backoff per feed if poll did not find updated content
  // TODO: de-activation of feeds with 404s
  // TODO: de-activation of too much time elapsed since feed had new articles
  // TODO: only poll if feed is active
  // TODO: pass along a stats histogram object that trackers poll stats

  // TODO: some entry link URLs from feeds are pre-chain-of-redirect-resolution, 
  // and are technically duplicates because each redirects to the same URL at the 
  // end of the redirect chain. Therefore we should be storing the terminal link,
  // not the source link. Or maybe we should be storing both. That way a lookup
  // will detect the article already exists and we store fewer dups
  // I think that fetching does use responseURL, but we end up not using response
  // URL at some point later in processing. Basically, the responseURL has to be
  // detected at the point of augment, and we want to rewrite at that point
  // So this note is here but technically this note belongs to several issues in
  // the holistic view of the update process. Maybe it does not belong to subscribe
  // and only to poll because maybe only poll should be downloading and augmenting
  // entries, and subscribe should just add the feed and not add any entries because
  // subscribe should be near instant. So subscribe should store the feed and then
  // enqueue a one-feed poll update.
  static pollFeeds() {
    console.debug('Polling feeds');

    if(!window.navigator.onLine) {
      console.debug('Polling canceled as not online');
      return;
    }

    chrome.permissions.contains({permissions: ['idle']}, function(permitted) {
      const IDLE_PERIOD = 60 * 5; // 5 minutes
      if(permitted) {
        chrome.idle.queryState(IDLE_PERIOD, Background.pollOnQueryIdleState);
      } else {
        Database.open(Background.pollIterateFeeds);
      }
    });
  }

  static pollOnQueryIdleState(state) {
    if(state === 'locked' || state === 'idle') {
      Database.open(Background.pollIterateFeeds);
    } else {
      console.debug('Polling canceled as not idle');
      Background.onPollComplete();
    }
  }

  // TODO: I need to use some async.* function that can trigger
  // a final callback once each feed has been processed
  // Kind of like async.until?
  // Or basically I may need to write Feed.forEach to work like
  // async.forEach. Instead of binding its callback to 
  // transaction.oncomplete, I need to wait for all the callbacks
  // to callback
  static pollIterateFeeds(event) {
    if(event.type === 'success') {
      const connection = event.target.result;
      Feed.forEach(connection, Background.pollFetchFeed.bind(null, connection), 
        false, Background.onPollComplete);
    } else {
      console.debug(event);
      Background.onPollComplete();      
    }
  }

  static pollFetchFeed(connection, feed) {
    const timeout = 10 * 1000;
    Feed.fetch(feed.url, timeout, function(event, remoteFeed) {
      // console.debug('Fetched %s', feed.url);
      if(event) {
        console.log('Error fetching %s', feed.url);
        console.dir(event);
      } else {
        Feed.put(connection, feed, remoteFeed, 
          onPut.bind(null, remoteFeed));        
      }
    });

    function onPut(remoteFeed, event) {
      async.forEach(remoteFeed.entries, 
        Background.pollFindEntryByLink.bind(null, connection, feed), 
        Background.pollOnEntriesUpdated.bind(null, connection));
    }
  }

  // The issue is that this gets called per feed. I want to only call it 
  // when _everything_ is finished. We cannot do it with Feed.forEach 
  // above because that fires off independent async calls and finishes
  // before waiting for them to complete, which it kind of has to because
  // we do not know the number of feeds in advance and I don't want to count
  // or preload all into an array.
  // Temporarily just update the badge for each feed processed
  static pollOnEntriesUpdated(connection) {
    Badge.update(connection);
  }

  static pollFindEntryByLink(connection, feed, entry, callback) {
    // console.debug('Processing entry %s', entry.link);
    Entry.findByLink(connection, entry, function(event) {
      if(event.target.result) {
        callback();
      } else {
        const timeout = 20 * 1000;
        Background.augmentEntry(entry, timeout, onAugment);
      }
    });

    function onAugment(errorEvent) {
      Entry.put(connection, feed, entry, callback);
    }
  }

  // NOTE: due to above issues, this gets called when finished with 
  // iterating feeds, BUT prior to finishing entry processing
  static onPollComplete() {
    console.debug('Polling completed');
    localStorage.LAST_POLL_DATE_MS = String(Date.now());
    // const message = {type: 'pollCompleted'};
    // chrome.runtime.sendMessage(message);
    Notification.show('Updated articles');
  }

  // TODO: I'd prefer this function pass back any errors to the callback. This
  // would require the caller that wants to not break from async.forEach early
  // wrap the call.
  // TODO: consider embedding/sandboxing iframes?
  // TODO: html compression? like enforce boolean attributes? see kangax lib
  // TODO: scrubbing/html-tidy (e.g. remove images without src attribute?)
  // TODO: if pdf content type then maybe we embed iframe with src
  // to PDF? also, we should not even be trying to fetch pdfs? is this
  // just a feature of fetchHTML or does it belong here?
  // TODO: do something with responseURL?
  static augmentEntry(entry, timeout, callback) {
    const request = new XMLHttpRequest();
    request.timeout = timeout;
    request.ontimeout = callback;
    request.onerror = callback;
    request.onabort = callback;
    request.onload = Background._onAugmentLoad.bind(request, entry, callback);
    request.open('GET', entry.link, true);
    request.responseType = 'document';
    request.send();  
  }

  static _onAugmentLoad(entry, callback, event) {
    const request = event.target;
    const document = request.responseXML;
    if(!document || !document.body) {
      callback(new Error('No document'));
      return;
    }

    Background.resolveDocumentURLs(document, request.responseURL);

    const images = document.getElementsByTagName('img');
    async.forEach(images, Background.fetchImageDimensions, function() {
      // TODO: should we be using document.documentElement.innerHTML?
      const content = document.body.innerHTML;
      if(content) {
        entry.content = content;
      }
      callback();
    });
  }

  // TODO: think of a better way to specify the proxy. I should not be
  // relying on window explicitly.
  static fetchImageDimensions(image, callback) {
    const src = (image.getAttribute('src') || '').trim();
    if(!src || URLUtils.isDataURI(src) || !Background._hasWidth(image)) {
      callback();
      return;
    }

    const document = window.document;
    const proxy = document.createElement('img');
    proxy.onload = function(event) {
      const proxy = event.target;
      image.width = proxy.width;
      image.height = proxy.height;
      callback();
    };
    proxy.onerror = function(event) {
      callback();
    };
    proxy.src = src;
  }

  static _hasWidth(image) {
    const width = (image.getAttribute('width') || '').trim();
    return width && image.width && width !== '0' && 
      !/^0\s*px/i.test(width);
  }

  /**
   * TODO: support img srcset
   * TODO: support style.backgroundImage?
   * TODO: the new template tag?
   * NOTE: not supporting applet
   * NOTE: iframe.srcdoc?
   * NOTE: ignores param values with URIs
   * NOTE: could stripping the base tag could lead to invalid urls??? Should
   * the base tag, if present, be considered when resolving elements?
   * Also note that there could be multiple base tags, the logic for handling
   * it properly is all laid out in some RFC standard somewhere, and is probably
   * present in Webkit source.
   */
  static resolveDocumentURLs(document, baseURL) {
    const forEach = Array.prototype.forEach;
    const bases = document.getElementsByTagName('base');
    forEach.call(bases, function(element) {
      element.remove();
    });

    // TODO: build this from the map
    const RESOLVABLES_QUERY = 'a, area, audio, blockquote, embed, ' + 
      'iframe, form, img, link, object, script, source, track, video';
    const elements = document.querySelectorAll(RESOLVABLES_QUERY);
    forEach.call(elements, function(element) {
      const name = element.localName;
      const attribute = Background.RESOLVABLE_ATTRIBUTES.get(name);
      const url = (element.getAttribute(attribute) || '').trim();
      try {
        const uri = new URI(url);
        if(!uri.protocol()) {
          const resolved = uri.absoluteTo(baseURL).toString();
          element.setAttribute(attribute, resolved);
        }
      } catch(e) {

      }
    });
  }

  // TODO: do we need a limit on the number of entries archived per 
  // run? Maybe that is stupid
  static archiveEntries() {
    const stats = {
      processed: 0
    };

    Database.open(Background.archiveOnConnect.bind(null, stats));
  }

  static archiveOnConnect(stats, event) {
    if(event.type === 'success') {
      const connection = event.target.result;
      const transaction = connection.transaction('entry', 'readwrite');
      transaction.oncomplete = Background.onArchiveComplete.bind(
        transaction, stats);
      const store = transaction.objectStore('entry');
      const index = store.index('archiveState-readState');
      const range = IDBKeyRange.only([Entry.UNARCHIVED, Entry.READ]);
      const request = index.openCursor(range);
      request.onsuccess = Background.archiveNextEntry.bind(request, stats);
    } else {
      console.debug('Archive aborted due to connection error %o', event);
    }
  }

  // We leave intact entry.id, entry.feed, entry.link, update
  // archiveState, and create archiveDate
  static archiveNextEntry(stats, event) {
    const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
    const ENTRY_LIMIT = 1000;
    const cursor = event.target.result;
    if(!cursor)
      return;
    stats.processed++;
    const entry = cursor.value;
    const now = Date.now();
    const age = now - entry.created;
    if(age > EXPIRES_AFTER_MS) {
      delete entry.content;
      delete entry.feedLink;
      delete entry.feedTitle;
      delete entry.pubdate;
      delete entry.readDate;
      delete entry.created;
      delete entry.updated;
      delete entry.title;
      delete entry.author;
      entry.archiveState = Entry.ARCHIVED;
      entry.archiveDate = now;
      cursor.update(entry);
    }

    chrome.runtime.sendMessage({type: 'archivedEntry', entry: entry});
    if(stats.processed < ENTRY_LIMIT)
      cursor.continue();
  }

  static onArchiveComplete(stats, event) {
    console.log('Archived %s entries', stats.processed);
  }
}

Background.RESOLVABLE_ATTRIBUTES = new Map([
  ['a', 'href'],
  ['area', 'href'],
  ['audio', 'src'],
  ['blockquote', 'cite'],
  ['embed', 'src'],
  ['iframe', 'src'],
  ['form', 'action'],
  ['img', 'src'],
  ['link', 'href'],
  ['object', 'data'],
  ['script', 'src'],
  ['source', 'src'],
  ['track', 'src'],
  ['video', 'src']
]);

chrome.alarms.onAlarm.addListener(Background.onAlarm);
chrome.alarms.create('archive', {periodInMinutes: 24 * 60});
chrome.alarms.create('poll', {periodInMinutes: 20});
chrome.runtime.onInstalled.addListener(Background.onInstalled);
chrome.browserAction.onClicked.addListener(Background.onBadgeClick);
