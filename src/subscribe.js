// See license.md

'use strict';

{

function subscribe(feedDbConn, iconCacheConn, feed, suppressNotifications, log,
  callback) {

  if(!Feed.getURL(feed)) {
    throw new TypeError();
  }

  log = log || SilentConsole;
  log.log('Subscribing to', Feed.getURL(feed));

  const ctx = {
    'feed': feed,
    'didSubscribe': false,
    'shouldCloseDB': false,
    'log': log,
    'suppressNotifications': suppressNotifications,
    'callback': callback,
    'feedDbConn': feedDbConn,
    'iconCacheConn': iconCacheConn,
    'feedCache': new FeedCache(log),
    'feedDb': new FeedDb(log)
  };

  if(feedDbConn) {
    log.debug('Checking if subscribed using provided connection');
    ctx.feedCache.hasFeedURL(feedDbConn, Feed.getURL(feed),
      onFindFeed.bind(ctx));
  } else {
    ctx.feedDb.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
  }
}

function openDBOnSuccess(event) {
  this.log.log('Connected to database', this.feedDb.name);
  this.feedDbConn = event.target.result;
  this.shouldCloseDB = true;
  this.log.debug('Checking if subscribed using on demand connection');
  this.feedCache.hasFeedURL(this.feedDbConn, Feed.getURL(this.feed),
    onFindFeed.bind(this));
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this, {'type': 'ConnectionError'});
}

function onFindFeed(didFind, event) {
  if(didFind) {
    console.debug('Already subscribed to', Feed.getURL(this.feed));
    onComplete.call(this, {'type': 'ConstraintError'});
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    this.feedCache.addFeed(this.feedDbConn, this.feed, onAddFeed.bind(this));
    return;
  }

  const requestURL = new URL(Feed.getURL(this.feed));
  const excludeEntries = true;
  fetchFeed(requestURL, excludeEntries, this.log, onFetchFeed.bind(this));
}

function onFetchFeed(event) {
  if(event.type !== 'success') {
    this.log.log('Fetch error type', event.type);
    if(event.type === 'InvalidMimeType') {
      onComplete.call(this, {'type': 'FetchMimeTypeError'});
    } else {
      onComplete.call(this, {'type': 'FetchError'});
    }
    return;
  }

  // TODO: before merging and looking up favicon and adding, check if the user
  // is already subscribed to the redirected url, if a redirect occurred

  this.feed = Feed.merge(this.feed, event.feed);
  const iconCache = new FaviconCache(this.log);

  let url = null;
  if(this.feed.link) {
    url = new URL(this.feed.link);
  } else {
    const feedURL = new URL(Feed.getURL(this.feed));
    // We know the actual url is not a webpage, but its origin probably is
    url = new URL(feedURL.origin);
  }

  const doc = null;
  lookupFavicon(iconCache, this.iconCacheConn, url, doc, this.log,
    onLookupIcon.bind(this));
}

function onLookupIcon(iconURL) {
  if(iconURL) {
    this.feed.faviconURLString = iconURL.href;
  }

  this.feedCache.addFeed(this.feedDbConn, this.feed, onAddFeed.bind(this));
}

function onAddFeed(event) {
  if(event.type === 'success') {
    this.log.log('Successfully stored new feed');
    this.didSubscribe = true;
    onComplete.call(this, {'type': 'success', 'feed': event.feed});
  } else {
    onComplete.call(this, {'type': event.type});
  }
}

function onComplete(event) {
  if(this.shouldCloseDB && this.feedDbConn) {
    this.log.log('Requesting database %s to close', this.feedDb.name);
    this.feedDbConn.close();
  }

  if(!this.suppressNotifications && this.didSubscribe) {
    // Grab data from the sanitized feed instead of the input
    const feed = event.feed;
    const displayString = feed.title ||  Feed.getURL(feed);
    const message = 'Subscribed to ' + displayString;
    showNotification('Subscription complete', message,
      feed.faviconURLString);
  }

  if(this.callback) {
    this.callback(event);
  }
}

this.subscribe = subscribe;

}
