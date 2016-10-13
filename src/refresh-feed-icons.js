// See license.md

'use strict';

{

function refreshFeedIcons(log) {
  log.log('Refreshing feed favicons...');
  const ctx = {
    'pendingCount': 0,
    'numFeedsModified': 0,
    'log': log,
    'conn': null,
    'feedDb': new FeedDb(log),
    'feedCache': new FeedCache(log),
    'iconCache': new FaviconCache(log),
    'iconCacheConn': null
  };
  ctx.feedDb.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
}

function openDBOnSuccess(event) {
  this.log.debug('Connected to database', this.feedDb.name);
  this.conn = event.target.result;
  this.iconCache.connect(iconCacheConnectOnSuccess.bind(this),
    iconCacheConnectOnError.bind(this));
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this);
}

function iconCacheConnectOnSuccess(event) {
  this.log.debug('Connected to favicon cache');
  this.iconCacheConn = event.target.result;
  this.feedCache.getAllFeeds(this.conn, onGetAllFeeds.bind(this));
}

function iconCacheConnectOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this);
}

function onGetAllFeeds(feeds) {
  if(!feeds.length) {
    onComplete.call(this);
    return;
  }

  this.pendingCount = feeds.length;
  for(let feed of feeds) {
    lookup.call(this, feed);
  }
}

function lookup(feed) {
  let lookupURL = null;
  if(feed.link) {
    lookupURL = new URL(feed.link);
  } else {
    const feedURL = new URL(Feed.getURL(feed));
    lookupURL = new URL(feedURL.origin);
  }

  this.log.debug('Looking up favicon for feed %s using url %s',
    Feed.getURL(feed), lookupURL.href);

  const doc = null;
  lookupFavicon(this.iconCache, this.iconCacheConn, lookupURL, doc, this.log,
    onLookup.bind(this, feed));
}

function onLookup(feed, iconURL) {
  this.log.debug('lookupFavicon result for feed', Feed.getURL(feed), iconURL ?
    iconURL.href: 'no icon');

  if(iconURL) {
    if(!feed.faviconURLString || feed.faviconURLString !== iconURL.href) {
      this.log.debug('Setting feed %s favicon to %s', Feed.getURL(feed),
        iconURL.href);
      this.numFeedsModified++;
      feed.faviconURLString = iconURL.href;
      this.feedCache.putFeed(this.conn, feed, onPutFeed.bind(this));
    }
  }

  this.pendingCount--;
  if(!this.pendingCount) {
    onComplete.call(this);
  }
}

function onPutFeed(type, feed) {
  if(type === 'success') {
    this.log.debug('Updated feed', Feed.getURL(feed));
  }
}

function onComplete() {
  if(this.iconCacheConn) {
    this.log.debug('Closing icon cache connection');
    this.iconCacheConn.close();
  }

  if(this.conn) {
    this.log.debug('Requesting %s database connection to close',
      this.feedDb.name);
    this.conn.close();
  }

  // This may occur in the log prior to pending requests resolving
  this.log.log('Finished refreshing feed favicons, modified',
    this.numFeedsModified, 'feeds');
}

this.refreshFeedIcons = refreshFeedIcons;

}
