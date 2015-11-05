// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: customizable update schedules per feed
// TODO: backoff per feed if poll did not find updated content
// TODO: de-activation of feeds with 404s
// TODO: de-activation of too much time elapsed since feed had new articles
// TODO: only poll if feed is active

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

'use strict';

class Poll {

  static start() {
    console.debug('Polling feeds');

    if(!window.navigator.onLine) {
      console.debug('Polling canceled as not online');
      return;
    }

    chrome.permissions.contains({permissions: ['idle']}, function(permitted) {
      const IDLE_PERIOD = 60 * 5; // 5 minutes
      if(permitted) {
        chrome.idle.queryState(IDLE_PERIOD, Poll.onQueryIdleState);
      } else {
        Database.open(Poll.iterateFeeds);
      }
    });
  }

  static onQueryIdleState(state) {
    if(state === 'locked' || state === 'idle') {
      Database.open(Poll.iterateFeeds);
    } else {
      console.debug('Polling canceled as not idle');
      Poll.onComplete();
    }
  }

  // TODO: I need to use some async.* function that can trigger
  // a final callback once each feed has been processed
  // Kind of like async.until?
  // Or basically I may need to write Feed.forEach to work like
  // async.forEach. Instead of binding its callback to 
  // transaction.oncomplete, I need to wait for all the callbacks
  // to callback
  static iterateFeeds(event) {
    if(event.type === 'success') {
      const connection = event.target.result;
      Feed.forEach(connection, Poll.fetchFeed.bind(null, connection), 
        false, Poll.onComplete);
    } else {
      console.debug(event);
      Poll.onComplete();      
    }
  }

  static fetchFeed(connection, feed) {
    const timeout = 10 * 1000;
    Feed.fetch(feed.url, timeout, function(event, remoteFeed) {
      // console.debug('Fetched %s', feed.url);
      if(event) {
        console.dir(event);
      } else {
        Feed.put(connection, feed, remoteFeed, 
          onPut.bind(null, remoteFeed));        
      }
    });

    function onPut(remoteFeed, event) {
      async.forEach(remoteFeed.entries, 
        Poll.findEntryByLink.bind(null, connection, feed), 
        Poll.onEntriesUpdated.bind(null, connection));
    }
  }


  // The issue is that this gets called per feed. I want to only call it 
  // when _everything_ is finished. We cannot do it with Feed.forEach 
  // above because that fires off independent async calls and finishes
  // before waiting for them to complete, which it kind of has to because
  // we do not know the number of feeds in advance and I don't want to count
  // or preload all into an array.
  // Temporarily just update the badge for each feed processed
  static onEntriesUpdated(connection) {
    Badge.update(connection);
  }

  static findEntryByLink(connection, feed, entry, callback) {
    // console.debug('Processing entry %s', entry.link);
    Entry.findByLink(connection, entry, function(event) {
      if(event.target.result) {
        callback();
      } else {
        const timeout = 20 * 1000;
        augmentEntryContent(entry, timeout, onAugment);
      }
    });

    function onAugment(errorEvent) {
      Entry.put(connection, feed, entry, callback);
    }
  }

  // NOTE: due to above issues, this gets called when finished with 
  // iterating feeds, BUT prior to finishing entry processing
  static onComplete() {
    console.debug('Polling completed');
    localStorage.LAST_POLL_DATE_MS = String(Date.now());
    // const message = {type: 'pollCompleted'};
    // chrome.runtime.sendMessage(message);
    Notification.show('Updated articles');
  }
}
