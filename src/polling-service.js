// See license.md

'use strict';

class PollingService {
  constructor() {
    this.log = {
      'log': function(){},
      'warn': function(){},
      'debug': function(){},
      'error': function(){}
    };

    this.allowMetered = true;
    this.ignoreIdleState = false;
    this.ignoreRecencyCheck = false;
    this.ignoreModifiedCheck = false;

    // Must idle for this many seconds before considered idle
    this.idlePeriod = 30;

    // Period (ms) during which feeds considered recently polled
    this.recencyPeriod = 5 * 60 * 1000;

    // How many ms before feed fetch is considered timed out
    this.fetchFeedTimeout = 5000;
    // How many ms before html fetch is considered timed out
    this.fetchHTMLTimeout = 5000;

    this.fetchImageTimeout = 3000;

    this.db = new ReaderDb();
    this.readerConn = null;
    this.fs = new FaviconService();

    this.bpFilter = new BoilerplateFilter();
  }

  queryIdleState(idleSecs) {
    return new Promise(function(resolve) {
      chrome.idle.queryState(idleSecs, resolve);
    });
  }

  isFeedNotRecent(feed) {
    if(!feed.dateFetched)
      return true; // Retain feeds never fetched
    const timeSincePolled = new Date() - feed.dateFetched;//diff in ms
    const isRecent = timeSincePolled < this.recencyPeriod;
    if(isRecent)
      this.log.debug('Feed polled too recently', Feed.getURL(feed));
    return !isRecent; // Only retain feeds that are not recent
  }

  async pollFeeds() {
    this.log.log('Checking for new articles...');

    if('onLine' in navigator && !navigator.onLine) {
      this.log.debug('Polling canceled because offline');
      return;
    }

    // experimental
    if(!this.allowMetered && 'NO_POLL_METERED' in localStorage &&
      navigator.connection && navigator.connection.metered) {
      this.log.debug('Polling canceled due to metered connection');
      return;
    }

    if(!this.ignoreIdleState && 'ONLY_POLL_IF_IDLE' in localStorage) {
      const state = await this.queryIdleState(this.idlePeriod);
      if(state !== 'locked' && state !== 'idle') {
        this.log.debug('Polling canceled due to idle requirement');
        return;
      }
    }

    let numAdded = 0;

    const feedStore = new FeedStore();


    try {
      const conns = await Promise.all([this.db.connect(), this.fs.connect()]);
      this.readerConn = conns[0];
      feedStore.conn = this.readerConn;
      let feeds = await feedStore.getAll();
      if(!this.ignoreRecencyCheck)
        feeds = feeds.filter(this.isFeedNotRecent, this);
      const promises = feeds.map(this.processFeedNoRaise, this);
      const resolutions = await Promise.all(promises);
      numAdded = resolutions.reduce((sum, added) => sum + added, 0);
      if(numAdded)
        await Badge.updateUnreadCount(this.readerConn);
    } finally {
      if(this.readerConn)
        this.readerConn.close();
      this.fs.close();
    }

    if(numAdded)
      DesktopNotification.show('Updated articles',
        `Added ${numAdded} new articles`);

    const chan = new BroadcastChannel('poll');
    chan.postMessage('completed');
    chan.close();

    this.log.debug('Polling completed');
    return numAdded;
  }

  // Suppresses processFeed exceptions to avoid Promise.all fail fast behavior
  async processFeedNoRaise(feed) {
    let numEntriesAdded = 0;
    try {
      numEntriesAdded = await this.processFeed(feed);
    } catch(error) {
      this.log.warn(error);
    }
    return numEntriesAdded;
  }

  entryURLIsValid(entry) {
    const url = entry.urls[0];
    let urlo;
    try {
      urlo = new URL(url);
    } catch(error) {
      this.log.warn(error);
      return false;
    }

    // hack for bad feed
    if(urlo.pathname.startsWith('//'))
      return false;
    return true;
  }

  entryHasURL(entry) {
    return entry.urls && entry.urls.length;
  }

  isFeedUnmodified(local, remote) {
    return local.dateUpdated && local.dateLastModified &&
      remote.dateLastModified && local.dateLastModified.getTime() ===
        remote.dateLastModified.getTime();
  }

  filterDupEntries(entries) {
    const output = [];
    const seenURLs = [];

    for(let entry of entries) {
      let found = false;
      for(let url of entry.urls) {
        if(seenURLs.includes(url)) {
          found = true;
          break;
        }
      }

      if(!found) {
        output.push(entry);
        seenURLs.push(...entry.urls);
      }
    }

    return output;
  }

  async processFeed(localFeed) {
    let numAdded = 0;
    const url = Feed.getURL(localFeed);

    // Explicit assignment due to strange destructuring rename behavior
    const {feed, entries} = await ResourceLoader.fetchFeed(url,
      this.fetchFeedTimeout);
    const remoteFeed = feed;
    let remoteEntries = entries;

    if(!this.ignoreModifiedCheck &&
      this.isFeedUnmodified(localFeed, remoteFeed)) {
      this.log.debug('Feed not modified', url,
        localFeed.dateLastModified,
        remoteFeed.dateLastModified);
      return numAdded;
    }

    const mergedFeed = Feed.merge(localFeed, remoteFeed);
    let storableFeed = Feed.sanitize(mergedFeed);
    storableFeed = ObjectUtils.filterEmptyProps(storableFeed);

    remoteEntries = remoteEntries.filter(this.entryHasURL);
    remoteEntries = remoteEntries.filter(this.entryURLIsValid);
    remoteEntries = this.filterDupEntries(remoteEntries);
    remoteEntries.forEach((e) => e.feed = localFeed.id);
    remoteEntries.forEach((e) => e.feedTitle = storableFeed.title);

    // TODO: feedStore should be an instance variable
    const feedStore = new FeedStore();
    feedStore.conn = this.readerConn;

    // TODO: why pass feed? Maybe it isn't needed by processEntry? Can't I just
    // do any delegation of props now, so that processEntry does not need to
    // have any knowledge of the feed?
    const promises = remoteEntries.map((entry) => this.processEntry(
      storableFeed, entry));
    promises.push(feedStore.put(storableFeed));
    const resolutions = await Promise.all(promises);
    resolutions.pop();// remove feedStore.put promise
    return resolutions.reduce((sum, r) => r ? sum + 1 : sum, 0);
  }

  // Rewrites the entries url and attempts to append the url to the entry.
  // Returns true if the rewritten url was appended.
  rewriteEntryURL(entry) {
    const url = Entry.getURL(entry);
    const rewrittenURL = rewrite_url(url);
    const beforeAppendLen = entry.urls.length;
    if(rewrittenURL)
      Entry.addURL(entry, rewrittenURL);
    return entry.urls.length > beforeAppendLen;
  }

  // Resolve with true if entry was added, false if not added
  // TODO: instead of trying to not reject in case of an error, maybe this should
  // reject, and I use a wrapping function than translates rejections into
  // negative resolutions
  // TODO: favicon lookup should be deferred until after fetch to avoid
  // lookup up intermediate urls when possible
  async processEntry(feed, entry) {

    // TODO: this should be an instance property
    const entryStore = new EntryStore();
    entryStore.conn = this.readerConn;

    const didRewrite = this.rewriteEntryURL(entry);


    if(this.shouldExcludeEntry(entry))
      return false;
    if(await entryStore.containsURL(entry.urls[0]))
      return false;
    if(didRewrite && await entryStore.containsURL(Entry.getURL(entry)))
      return false;

    const lookupURL = new URL(Entry.getURL(entry));
    const iconURL = await this.fs.lookup(lookupURL);
    entry.faviconURLString = iconURL || feed.faviconURLString;

    // TODO: rename response_url to responseURL

    let doc, response_url;
    try {
      ({doc, response_url} = await ResourceLoader.fetchHTML(Entry.getURL(entry),
        this.fetchHTMLTimeout));
    } catch(error) {
      this.log.warn(error);
      this.prepLocalEntry(entry);
      return await this.addEntry(entry);
    }

    const didRedirect = this.didRedirect(entry.urls, response_url);
    if(didRedirect) {
      if(await entryStore.containsURL(response_url))
        return false;
      Entry.addURL(entry, response_url);
    }

    this.transformLazyImages(doc);
    DOMScrubber.filterSourcelessImages(doc);
    DOMScrubber.filterInvalidAnchors(doc);
    resolve_doc(doc, new URL(Entry.getURL(entry)));
    this.filterTrackingImages(doc, config.tracking_hosts);

    await DocumentLayout.setDocumentImageDimensions(doc,
      this.fetchImageTimeout);
    this.prepDoc(Entry.getURL(entry), doc);
    entry.content = doc.documentElement.outerHTML.trim();
    return await this.addEntry(entry);
  }

  shouldExcludeEntry(entry) {
    const url = new URL(Entry.getURL(entry));
    const hostname = url.hostname;
    const pathname = url.pathname;
    if(config.interstitial_hosts.includes(hostname))
      return true;
    if(config.script_generated_hosts.includes(hostname))
      return true;
    if(config.paywall_hosts.includes(hostname))
      return true;
    if(config.requires_cookies_hosts.includes(hostname))
      return true;
    if(Mime.sniffNonHTML(pathname))
      return true;
    return false;
  }

  async addEntry(entry) {

    // TODO: this is sloppy, entryStore should be instance prop created once
    // not every call. This is temporary refactoring stage
    const entryStore = new EntryStore();
    entryStore.conn = this.readerConn;

    try {
      let result = await entryStore.add(entry);
      return true;
    } catch(error) {
      this.log.warn(error, Entry.getURL(entry));
    }
    return false;
  }

  stripURLHash(url) {
    const output = new URL(url);
    output.hash = '';
    return output.href;
  }

  // To determine where there was a redirect, compare the response url to the
  // entry's current urls, ignoring the hash.
  didRedirect(urls, response_url) {
    if(!response_url)
      throw new TypeError();
    const normURLs = urls.map(this.stripURLHash);
    return !normURLs.includes(response_url);
  }

  prepLocalEntry(entry) {
    if(!entry.content)
      return;
    const parser = new DOMParser();
    let doc;
    try {
      doc = parser.parseFromString(entry.content, 'text/html');
    } catch(error) {
      this.log.warn(error);
    }

    if(!doc || doc.querySelector('parsererror')) {
      entry.content = 'Cannot show document due to parsing error';
      return;
    }

    this.prepDoc(Entry.getURL(entry), doc);
    const content = doc.documentElement.outerHTML.trim();
    if(content)
      entry.content = content;
  }

  prepDoc(urlString, doc) {
    BP_TEMPLATE_FILTER.prune(urlString, doc);
    this.bpFilter.filterDocument(doc);

    const scrubber = new DOMScrubber();
    scrubber.scrub(doc);
    DOMScrubber.addNoReferrer(doc);
  }

  transformLazyImages(doc) {
    let numModified = 0;
    const images = doc.querySelectorAll('img');
    for(let img of images) {
      if(img.hasAttribute('src') || img.hasAttribute('srcset'))
        continue;
      for(let altName of config.lazy_image_attr_names) {
        if(img.hasAttribute(altName)) {
          const url = img.getAttribute(altName);
          if(url && !url.trim().includes(' ')) {
            img.removeAttribute(altName);
            img.setAttribute('src', url);
            numModified++;
            break;
          }
        }
      }
    }
    return numModified;
  }

  filterTrackingImages(doc, hosts) {
    const minValidURLLen = 3; // 1char hostname . 1char domain
    const images = doc.querySelectorAll('img[src]');
    let src, url;
    for(let image of images) {
      src = image.getAttribute('src');
      if(!src) continue;
      src = src.trim();
      if(!src) continue;
      if(src.length < minValidURLLen) continue;
      if(src.includes(' ')) continue;
      if(!/^https?:/i.test(src)) continue;
      try {
        url = new URL(src);
      } catch(error) {
        continue;
      }
      if(hosts.includes(url.hostname))
        image.remove();
    }
  }
}
