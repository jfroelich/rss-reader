// See license.md

'use strict';

class SubscriptionService {

  constructor() {
    this.verbose = false;
    this.suppressNotifications = false;
    this.readerDb = new ReaderDb();
    this.faviconService = new FaviconService();
    this.fetchTimeout = 2000;
    this.readerConn = null;
    this.feedStore = new FeedStore();
    this.entryStore = new EntryStore();
  }

  async connect() {
    const connectionsArray = await Promise.all([this.readerDb.connect(),
      this.faviconService.connect()]);
    this.readerConn = connectionsArray[0];

    this.feedStore.conn = this.readerConn;
    this.entryStore.conn = this.readerConn;
  }

  close() {
    if(this.readerConn)
      this.readerConn.close();
    this.faviconService.close();
  }

  // Returns the feed that was added if successful
  async subscribe(feed) {
    const url = Feed.getURL(feed);

    if(this.verbose)
      console.log('Subscribing to feed with url', url);
    if(await this.feedStore.containsURL(url)) {
      if(this.verbose)
        console.warn('Already subscribed to feed with url', url);
      return;
    }

    if('onLine' in navigator && !navigator.onLine) {
      if(this.verbose)
        console.debug('Proceeding with offline subscription');
      // There is no notification when offline
      return await this.feedStore.add(feed);
    }

    // TODO: if redirected on fetch, check for redirect url contained in db
    let remoteFeed = await this.fetchFeed(url);
    if(!remoteFeed)
      return;

    const mergedFeed = Feed.merge(feed, remoteFeed);
    await this.updateFavicon(mergedFeed);
    const addedFeed = await this.feedStore.add(mergedFeed);
    this.showSubNotification(addedFeed);
    return addedFeed;
  }

  // A fetch error is not fatal, just return null
  async fetchFeed(url) {
    let feed = null;
    try {
      ({feed} = await ResourceLoader.fetchFeed(url, this.fetchTimeout));
    } catch(error) {
      if(this.verbose)
        console.warn(error);
    }
    return feed;
  }

  async updateFavicon(feed) {
    // TODO: use the lookup function in feed-favicon.js
    // TODO: currently this is bad because it assumes feed.link is valid
    let lookupURL;
    if(feed.link) {
      lookupURL = new URL(feed.link);
    } else {
      const feedURL = new URL(Feed.getURL(feed));
      lookupURL = new URL(feedURL.origin);
    }

    // Lookup errors are not fatal
    try {
      const iconURL = await this.faviconService.lookup(lookupURL);
      feed.faviconURLString = iconURL;
    } catch(error) {
      if(this.verbose)
        console.warn(error);
    }
  }

  showSubNotification(feed) {
    if(this.suppressNotifications)
      return;
    const title = 'Subscription complete';
    const feedName = feed.title || Feed.getURL(feed);
    const message = 'Subscribed to ' + feedName;
    DesktopNotification.show(title, message, feed.faviconURLString);
  }

  assertValidFeedId(feedId) {
    if(!Number.isInteger(feedId) || feedId < 1)
      throw new TypeError(`Invalid feed id ${feedId}`);
  }

  async unsubscribe(feedId) {
    if(this.verbose)
      console.log('Unsubscribing from feed', feedId);
    this.assertValidFeedId(feedId);
    const chan = new BroadcastChannel('db');
    let ids = null;

    try {
      const tx = this.readerConn.transaction(['feed', 'entry'], 'readwrite');
      ids = await this.entryStore.getIds(tx, feedId);
      const proms = ids.map((entryId) =>
        this.entryStore.remove(tx, entryId, chan));
      proms.push(this.feedStore.remove(tx, feedId));
      await Promise.all(proms);
    } finally {
      chan.close();
    }

    if(this.verbose) {
      console.debug('Unsubscribed from feed id', feedId);
      console.debug('Deleted %d entries', ids.length);
    }

    return ids.length;
  }
}
