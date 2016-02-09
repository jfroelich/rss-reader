// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

function pollFeeds() {
  console.debug('Polling feeds');

  if(!navigator.onLine) {
    console.debug('Polling canceled as offline');
    return;
  }

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
    pollFindEntryByLink.bind(null, connection, feed),
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
  updateBadge(connection);
}

function pollFindEntryByLink(connection, feed, entry, callback) {
  // console.debug('Processing entry %s', entry.link);
  findEntryByLink(connection, entry.link,
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
    storeEntry(connection, entry, callback);
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
