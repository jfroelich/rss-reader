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

  async jrDbConnect() {
    const connectionsArray = await Promise.all([this.readerDb.jrDbConnect(),
      this.faviconService.jrDbConnect()]);
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
    const url = jrFeedGetURL(feed);

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

    // TODO: if redirected, check if redirect exists
    let remoteFeed = await this.fetchFeed(url);
    if(!remoteFeed)
      return;

    const mergedFeed = jrFeedMerge(feed, remoteFeed);
    await this.updateFavicon(mergedFeed);
    const addedFeed = await this.feedStore.add(mergedFeed);
    this.showSubNotification(addedFeed);
    return addedFeed;
  }

  // A fetch error is not fatal
  async fetchFeed(url) {
    let feed = null;
    try {
      ({feed} = await jrFetchFeed(url, this.fetchTimeout));
    } catch(error) {
      if(this.verbose)
        console.warn(error);
    }
    return feed;
  }

  async updateFavicon(feed) {
    const lookupURL = FeedFavicon.getLookupURL(feed);

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
    const feedName = feed.title || jrFeedGetURL(feed);
    const message = 'Subscribed to ' + feedName;
    jrExtensionShowNotification(title, message, feed.faviconURLString);
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

    // This does not delegate to entry store because the feed remove call
    // is concurrent with the entry remove calls, making it so unique to this
    // situation that I would have to move most of this function into the entry
    // store. Therefore it is reasonable to require the tx to be exposed and
    // to have this function tied explicitly to an indexedDB storage pattern.
    // In addition, this shares a transaction across both feeds and entries.

    try {
      const tx = this.readerConn.transaction(['feed', 'entry'], 'readwrite');
      ids = await this.entryStore.getIds(tx, feedId);
      const proms = ids.map((id) => this.entryStore.remove(tx, id, chan));
      proms.push(this.feedStore.remove(tx, feedId));
      await Promise.all(proms);
    } finally {
      chan.close();
    }

    if(this.verbose) {
      console.debug('Unsubscribed from feed id', feedId);
      console.debug('Deleted %d entries', ids.length);
    }

    jrExtensionUpdateBadge(this.entryStore);

    return ids.length;
  }
}
