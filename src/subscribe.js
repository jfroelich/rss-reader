// See license.md

'use strict';

{

function subscribe(conn, feed, suppressNotifications, log, callback) {
  if(!Feed.getURL(feed)) {
    throw new TypeError('feed missing url');
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
    'conn': conn,
    'feedCache': new FeedCache()
  };

  if(conn) {
    findFeed.call(ctx);
  } else {
    ctx.shouldCloseDB = true;
    const feedDb = new FeedDb();
    feedDb.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
  }
}

function openDBOnSuccess(event) {
  this.log.log('Connected to database');
  this.conn = event.target.result;
  findFeed.call(this);
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this, {'type': 'ConnectionError'});
}

// TODO: normalize feed url
function findFeed() {
  const feedURLString = Feed.getURL(this.feed);
  this.log.log('Checking if subscribed to', feedURLString);
  const tx = this.conn.transaction('feed');
  const store = tx.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(feedURLString);
  request.onsuccess = findFeedOnSuccess.bind(this);
  request.onerror = findFeedOnError.bind(this);
}

function findFeedOnSuccess(event) {
  const feedURL = Feed.getURL(this.feed);

  // Cannot resubscribe to an existing feed
  if(event.target.result) {
    console.debug('Already subscribed to', feedURL);
    onComplete.call(this, {'type': 'ConstraintError'});
    return;
  }

  // Subscribe while offline
  if('onLine' in navigator && !navigator.onLine) {
    this.feedCache.addFeed(this.conn, this.feed, onAddFeed.bind(this));
    return;
  }

  // Proceed with online subscription
  const requestURL = new URL(feedURL);
  const excludeEntries = true;
  fetchFeed(requestURL, excludeEntries, SilentConsole, onFetchFeed.bind(this));
}

function findFeedOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this, {'type': 'FindQueryError'});
}

function onFetchFeed(event) {
  if(event.type !== 'success') {
    this.log.log('fetch error');
    if(event.type === 'InvalidMimeType') {
      onComplete.call(this, {'type': 'FetchMimeTypeError'});
    } else {
      onComplete.call(this, {'type': 'FetchError'});
    }
    return;
  }

  // TODO: before merging and looking up favicon and adding, check if the user
  // is already subscribed to the redirected url


  this.feed = Feed.merge(this.feed, event.feed);

  const cache = new FaviconCache();

  // TODO: if falling back to feed url instead of link, use origin, because
  // we know that feed is just an xml file, this reduces the hoops that
  // lookupFavicon jumps through internally

  const urlString = this.feed.link ? this.feed.link : Feed.getURL(this.feed);
  const urlObject = new URL(urlString);
  const doc = null;
  lookupFavicon(cache, urlObject, doc, SilentConsole, onLookupIcon.bind(this));
}

function onLookupIcon(iconURL) {
  if(iconURL) {
    this.feed.faviconURLString = iconURL.href;
  }

  this.feedCache.addFeed(this.conn, this.feed, onAddFeed.bind(this));
}

function onAddFeed(event) {
  if(event.type === 'success') {
    this.log.log('stored new feed');
    this.didSubscribe = true;
    onComplete.call(this, {'type': 'success', 'feed': event.feed});
  } else {
    onComplete.call(this, {'type': event.type});
  }
}

function onComplete(event) {
  if(this.shouldCloseDB && this.conn) {
    this.log.log('requesting database to close');
    this.conn.close();
  }

  if(!this.suppressNotifications && this.didSubscribe) {
    // Grab data from the sanitized feed instead of the input
    const feed = event.feed;
    const displayString = feed.title ||  Feed.getURL(feed);
    const message = 'Subscribed to ' + displayString;
    rdr.notifications.show('Subscription complete', message,
      feed.faviconURLString);
  }

  if(this.callback) {
    this.callback(event);
  }
}

this.subscribe = subscribe;

}
