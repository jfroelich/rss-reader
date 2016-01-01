// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: customizable update schedules per feed
// TODO: backoff per feed if poll did not find updated content
// TODO: de-activation of feeds with 404s
// TODO: de-activation of too much time elapsed since feed had new articles
// TODO: only poll if feed is active
// TODO: store de-activated reason code
// TODO: store de-activated date
// TODO: pass along a stats histogram object that trackers poll stats


// TODO: navigator should be a dependency injection so it can be mocked?
// TODO: Database should be a dependency injection
// TODO: FeedStore should be a dependency injection
// TODO: FeedRequest should be a dependency injection
// TODO: EntryUtils should be a dependency injection
// TODO: showNotification should be a dependency injection
// TODO: async should be a dependncy injection? Maybe? Or maybe I should
// just completely get rid of this and roll my own like before, because
// I am not sure it is adding that much simplicity, and as noted, I
// am having trouble tracking when all requests are complete (see later)
// TODO: due to the large number of dependencies, make I should make
// it an object where the state is the dependencies? Maybe it would
// reduce the number of parameters passed around in continuations

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

// TODO: i need to figure out how to bypass feedproxy.google.com and rewrite
// the url properly, because it is screwing up everything. not to mention it
// is tracking clicks.

// TODO: maybe have an option to exclude PDFs or embed PDFs as iframes or
// something like that

{ // BEGIN ANONYMOUS NAMESPACE

function pollFeeds() {
  console.debug('Polling feeds');

  if(!navigator.onLine) {
    console.debug('Polling canceled as offline');
    return;
  }

  // TODO: use the new, more global, navigator.permission check instead of
  // the extension API

  chrome.permissions.contains({permissions: ['idle']},
    onCheckIdlePermission);
}

// Export global
this.pollFeeds = pollFeeds;

const IDLE_PERIOD = 60 * 5; // 5 minutes
function onCheckIdlePermission(permitted) {
  if(permitted) {
    chrome.idle.queryState(IDLE_PERIOD,
      onQueryIdleState);
  } else {
    openIndexedDB(iterateFeeds);
  }
}

function onQueryIdleState(state) {
  if(state === 'locked' || state === 'idle') {
    openIndexedDB(iterateFeeds);
  } else {
    console.debug('Polling canceled as not idle');
    onComplete();
  }
}

// TODO: I need to use some async.* function that can trigger
// a final callback once each feed has been processed
// Kind of like async.until?
// Or basically I may need to write Feed.forEach to work like
// async.forEach. Instead of binding its callback to
// transaction.oncomplete, I need to wait for all the callbacks
// to callback
function iterateFeeds(event) {
  if(event.type === 'success') {
    const connection = event.target.result;
    FeedStore.forEach(connection, pollFetchFeed.bind(null,
      connection), false, onComplete);
  } else {
    console.debug(event);
    onComplete();
  }
}

function pollFetchFeed(connection, feed) {
  const timeout = 10 * 1000;
  fetchFeed(feed.url, timeout,
    onFetchFeed.bind(null, connection, feed));
}

function onFetchFeed(connection, feed, event, remoteFeed) {
  // console.debug('Fetched %s', feed.url);
  if(event) {
    console.dir(event);
  } else {
    // TODO: if we are cleaning up the properties in FeedStore.put,
    // are we properly cascading those properties to the entries?
    FeedStore.put(connection, feed, remoteFeed,
      onPutFeed.bind(null, connection, feed, remoteFeed));
  }
}

function onPutFeed(connection, feed, remoteFeed, event) {
  async.forEach(remoteFeed.entries,
    findEntryByLink.bind(null, connection, feed),
    onEntriesUpdated.bind(null, connection));
}

// The issue is that this gets called per feed. I want to only call it
// when _everything_ is finished. We cannot do it with Feed.forEach
// above because that fires off independent async calls and finishes
// before waiting for them to complete, which it kind of has to because
// we do not know the number of feeds in advance and I don't want to count
// or preload all into an array.
// Temporarily just update the badge for each feed processed
function onEntriesUpdated(connection) {
  updateBadge(EntryStore, connection);
}

function findEntryByLink(connection, feed, entry, callback) {
  // console.debug('Processing entry %s', entry.link);
  EntryStore.findByLink(connection, entry,
    onFindEntry.bind(null, connection, feed, entry, callback));
}

function onFindEntry(connection, feed, entry, callback, event) {
  const localEntry = event.target.result;
  if(localEntry) {
    callback();
  } else {
    const timeout = 20 * 1000;
    augmentEntryContent(entry, timeout, onAugment);
  }

  function onAugment(event) {
    cascadeFeedProperties(feed, entry);
    EntryStore.put(connection, entry, callback);
  }
}

// Propagate certain feed properties into the entry so that the
// view does not need to query the feed store when iterating
// entries. Set the foreign key
function cascadeFeedProperties(feed, entry) {
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

// NOTE: due to above issues, this gets called when finished with
// iterating feeds, but BEFORE finishing processing
function onComplete() {
  console.log('Polling completed');
  localStorage.LAST_POLL_DATE_MS = String(Date.now());
  // const message = {type: 'pollCompleted'};
  // chrome.runtime.sendMessage(message);
  showNotification('Updated articles');
}

} // END ANONYMOUS NAMESPACE
