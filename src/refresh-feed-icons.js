// See license.md

'use strict';

{

function refreshFeedIcons(verbose) {
  const log = new LoggingService();
  log.enabled = verbose;

  log.log('Refreshing feed favicons...');
  const ctx = {'pendingCount': 0, 'log': log};
  const openDBTask = new FeedDb();
  openDBTask.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
}

function openDBOnSuccess(event) {
  this.conn = event.target.result;
  const verbose = false;
  const feedCache = new FeedCache(verbose);
  feedCache.getAllFeeds(this.conn, onGetAllFeeds.bind(this));
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this);
}

function onGetAllFeeds(feeds) {
  this.pendingCount = feeds.length;
  if(!this.pendingCount) {
    this.log.log('No feeds found');
    onComplete.call(this);
    return;
  }

  for(let feed of feeds) {
    lookup.call(this, feed);
  }
}

function lookup(feed) {
  this.log.debug('Checking', Feed.getURL(feed));

  let lookupURL = null;
  if(feed.link) {
    lookupURL = new URL(feed.link);
  } else {
    const feedURL = new URL(Feed.getURL(feed));
    lookupURL = new URL(feedURL.origin);
  }

  const cache = new FaviconCache();
  const verbose = false;
  const doc = null;
  lookupFavicon(cache, lookupURL, doc, verbose,
    onLookup.bind(this, feed));
}

function onLookup(feed, iconURL) {
  this.log.debug('lookup result', Feed.getURL(feed), iconURL ?
    iconURL.href: 'no icon');

  if(iconURL) {
    if(!feed.faviconURLString || feed.faviconURLString !== iconURL.href) {

      this.log.debug('Setting feed %s favicon to %s', Feed.getURL(feed),
        iconURL.href);
      feed.faviconURLString = iconURL.href;
      feed.dateUpdated = new Date();
      // async, does not wait for put request to complete
      const tx = this.conn.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.put(feed);

      // Only listen if logging
      if(this.log.enabled) {
        request.onsuccess = onPutSuccess.bind(this, feed);
        request.onerror = onPutError.bind(this, feed);
      }
    }
  }

  // The feed has been processed. If pendingCount reaches 0 then done
  this.pendingCount--;
  if(!this.pendingCount) {
    onComplete.call(this);
  }
}

function onPutSuccess(feed, event) {
  this.log.debug('Updated feed', Feed.getURL(feed));
}

// Treat database put errors as non-fatal
function onPutError(feed, event) {
  this.log.error(event.target.error);
}

function onComplete() {
  if(this.conn) {
    this.log.debug('Requesting database connection to close');
    this.conn.close();
  }

  // This may occur in the log prior to pending requests resolving
  this.log.log('Finished refreshing feed favicons');
}

this.refreshFeedIcons = refreshFeedIcons;

}
