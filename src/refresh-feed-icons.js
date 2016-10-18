// See license.md

'use strict';

{

function refresh_feed_icons(log) {
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
  ctx.feedDb.connect(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
}

function openDBOnSuccess(conn) {
  this.log.debug('Connected to database', this.feedDb.name);
  this.conn = conn;
  this.iconCache.connect(iconCacheConnectOnSuccess.bind(this),
    iconCacheConnectOnError.bind(this));
}

function openDBOnError() {
  onComplete.call(this);
}

function iconCacheConnectOnSuccess(event) {
  this.log.debug('Connected to database', this.iconCache.name);
  this.iconCacheConn = event.target.result;
  this.feedCache.get_all_feeds(this.conn, onGetAllFeeds.bind(this));
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
    const feedURL = new URL(get_feed_url(feed));
    lookupURL = new URL(feedURL.origin);
  }

  this.log.debug('Looking up favicon for feed %s using url %s',
    get_feed_url(feed), lookupURL.href);

  const doc = null;
  lookup_favicon(this.iconCache, this.iconCacheConn, lookupURL, doc, this.log,
    onLookup.bind(this, feed));
}

function onLookup(feed, iconURL) {
  this.log.debug('lookup_favicon result for feed', get_feed_url(feed), iconURL ?
    iconURL.href: 'no icon');

  if(iconURL) {
    if(!feed.faviconURLString || feed.faviconURLString !== iconURL.href) {
      this.log.debug('Setting feed %s favicon to %s', get_feed_url(feed),
        iconURL.href);
      this.numFeedsModified++;
      feed.faviconURLString = iconURL.href;
      this.feedCache.put_feed(this.conn, feed, onPutFeed.bind(this));
    }
  }

  this.pendingCount--;
  if(!this.pendingCount)
    onComplete.call(this);
}

function onPutFeed(type, feed) {
  if(type === 'success') {
    this.log.debug('Updated feed', get_feed_url(feed));
  }
}

function onComplete() {
  if(this.iconCacheConn)
    this.iconCacheConn.close();
  if(this.conn)
    this.conn.close();
  this.log.log('Refreshed favicons, modified',
    this.numFeedsModified, 'feeds');
}

this.refresh_feed_icons = refresh_feed_icons;

}
