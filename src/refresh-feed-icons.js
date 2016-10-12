// See license.md

'use strict';

{

function refreshFeedIcons(log) {
  log.log('Refreshing feed favicons...');
  const ctx = {'pendingCount': 0, 'log': log};
  const db = new FeedDb();
  db.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
}

function openDBOnSuccess(event) {
  this.log.log('Connected to database');
  this.conn = event.target.result;
  const feedCache = new FeedCache(SilentConsole);
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

  const iconCache = new FaviconCache(SilentConsole);
  const doc = null;
  lookupFavicon(iconCache, lookupURL, doc, SilentConsole,
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

      // TODO: delegate to FeedCache.putFeed, move .dateUpdated setting
      // into it. Then maybe think about how to use updateFeed instead, maybe
      // pass in a flag to skip sanitize/filter, or maybe have updateFeed call
      // putFeed but updateFeed does extra stuff
      const tx = this.conn.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.put(feed);

      // Only listen if logging
      if(this.log !== SilentConsole) {
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
