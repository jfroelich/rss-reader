// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: rename to FeedPoll, rename file, cleanup function names

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

class Poll {
 static pollFeeds() {
    console.debug('Polling feeds');

    if(!window.navigator.onLine) {
      console.debug('Polling canceled as not online');
      return;
    }

    chrome.permissions.contains({permissions: ['idle']}, function(permitted) {
      const IDLE_PERIOD = 60 * 5; // 5 minutes
      if(permitted) {
        chrome.idle.queryState(IDLE_PERIOD, Poll.pollOnQueryIdleState);
      } else {
        Database.open(Poll.pollIterateFeeds);
      }
    });
  }

  static pollOnQueryIdleState(state) {
    if(state === 'locked' || state === 'idle') {
      Database.open(Poll.pollIterateFeeds);
    } else {
      console.debug('Polling canceled as not idle');
      Poll.onPollComplete();
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
      FeedStore.forEach(connection, Poll.pollFetchFeed.bind(null, 
        connection), false, Poll.onPollComplete);
    } else {
      console.debug(event);
      Poll.onPollComplete();      
    }
  }

  static pollFetchFeed(connection, feed) {
    const timeout = 10 * 1000;
    FeedRequest.fetch(feed.url, timeout, function(event, remoteFeed) {
      // console.debug('Fetched %s', feed.url);
      if(event) {
        console.log('Error fetching %s', feed.url);
        console.dir(event);
      } else {
        FeedStore.put(connection, feed, remoteFeed, 
          onPut.bind(null, remoteFeed));        
      }
    });

    function onPut(remoteFeed, event) {
      async.forEach(remoteFeed.entries, 
        Poll.pollFindEntryByLink.bind(null, connection, feed), 
        Poll.pollOnEntriesUpdated.bind(null, connection));
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
    EntryStore.findByLink(connection, entry, function(event) {
      if(event.target.result) {
        callback();
      } else {
        const timeout = 20 * 1000;
        Poll.augmentEntry(entry, timeout, onAugment);
      }
    });

    // Propagate certain feed properties into the entry so that the 
    // view does not need to query the feed store when iterating 
    // entries. Also set the foreign key
    function denormalize(feed, entry) {
      // Set the foreign key
      entry.feed = feed.id;

      // Set up some functional dependencies
      entry.feedLink = feed.link;
      entry.feedTitle = feed.title;

      // Use the feed's date for undated entries
      if(!entry.pubdate && feed.date) {
        entry.pubdate = feed.date;
      }
    }

    function onAugment(errorEvent) {
      denormalize(feed, entry);
      EntryStore.put(connection, entry, callback);
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
    request.onload = Poll._onAugmentLoad.bind(request, entry, callback);
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

    Poll.resolveDocumentURLs(document, request.responseURL);

    const images = document.getElementsByTagName('img');
    async.forEach(images, Poll.fetchImageDimensions, function() {
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
    if(!src || URLUtils.isDataURI(src) || !Poll._hasWidth(image)) {
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

  // TODO: support img srcset
  // TODO: support style.backgroundImage?
  // TODO: the new template tag?
  // NOTE: not supporting applet
  // NOTE: iframe.srcdoc?
  // NOTE: ignores param values with URIs
  // NOTE: could stripping the base tag could lead to invalid urls??? Should
  // the base tag, if present, be considered when resolving elements?
  // Also note that there could be multiple base tags, the logic for handling
  // it properly is all laid out in some RFC standard somewhere, and is probably
  // present in Webkit source.
  static resolveDocumentURLs(document, baseURL) {

  	const wrapped = HTMLDocumentWrapper.wrap(document);

  	// Remove base elements
    wrapped.getElementsByTagName('base').forEach(function(element) {
      element.remove();
    });

	const attributeNames = new Map([
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

	// TODO: only select elements that have the attributes,
	// e.g. script[src]

	// TODO: is there a cleaner way of generating the selector string?
	// Maybe [...attributeNames.keys()]
	let keys = [];
	attributeNames.forEach(function(value, key) {
	  keys.push(key + '[' + value +']');
	});

    const selector = keys.join(',');
    wrapped.querySelectorAll(selector).forEach(function(element) {
      const name = attributeNames.get(element.localName);
      const url = element.getAttribute(name).trim();
      try {
        const uri = new URI(url);
        if(!uri.protocol()) {
          const resolved = uri.absoluteTo(baseURL).toString();
          element.setAttribute(name, resolved);
        }
      } catch(e) {

      }
    });
  }
}
