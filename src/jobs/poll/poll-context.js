import assert from "/src/assert/assert.js";
import FaviconCache from "/src/favicon/cache.js";
import FeedStore from "/src/feed-store/feed-store.js";

// TODO: this should probably be defined externally, because multiple modules are concerned with
// either sending or receiving messages from and to this channel
const CHANNEL_NAME = 'reader';

// TODO: consider that some of these defaults should come from the global config file?

// A PollContext is a basic function object that is intended to be used when calling pollFeed or
// pollFeeds. It helps simplify the number of arguments that each function needs. It is a function
// instead of a simple object to allow for simple allocation (use of "new").
export default function PollContext() {
  /* FeedStore */ this.feedStore;

  // {FaviconCache} cache for favicon lookups, it should be in the open state
  this.iconCache = undefined;

  // {Boolean} whether to check if a feed has been fetched too recently
  this.ignoreRecencyCheck = false;

  // {Boolean} whether to check if a feed xml file's last modified date is different than the
  // last known last modified date for a feed
  this.ignoreModifiedCheck = false;

  // {Number} If the time from when the feed was last fetched is less than this value, the feed is
  // considered to have been fetched recently. Represents 5 minutes (in milliseconds).
  this.recencyPeriodMs = 5 * 60 * 1000;

  // {Number} How long to wait before considering a fetch of a feed's xml to be a failure
  this.fetchFeedTimeoutMs = 5000;

  // {Number} How long to wait before considering a fetch of a web page to be a failure
  this.fetchHTMLTimeoutMs = 5000;

  // {Number} How long to wait before considering a fetch of an image to be a failure
  this.fetchImageTimeoutMs = 3000;

  // {Array} Additional accepted mime types when fetching a feed. Default to supporting
  // html and text-as-binary.
  this.extendedFeedTypes = [
    'application/octet-stream',
    'text/html'
  ];

  // {Boolean} If true, this signals to pollFeed that it is being called concurrently
  this.batchMode = false;

  // {BroadcastChannel} the channel on which to notify listeners of cross-window events
  this.channel = null;
}

// Open database connections
PollContext.prototype.open = async function() {
  // The caller is responsible for wiring up an instance of FeedStore prior to opening the
  // context.
  assert(this.feedStore instanceof FeedStore);

  // The caller is responsible for wiring up an instance of FaviconCache prior to opening the
  // context.
  assert(this.iconCache instanceof FaviconCache);

  // TODO: if the open stuff happened as part of the construction of the context, then there would
  // be no risk of duplicate stuff happening, like duplicate calls to open, or the context being
  // in an incorrect state prior to calling open. However I cannot use an async constructor. So this
  // suggests a builder or factory pattern would be 'better' because it is safer by making it
  // more difficult to do something incorrect. It would remove the need to even make such assertions
  // because the factory function body has full control of the variable from definition to
  // configuration, and each call to the function already returns a new variable. It would also
  // remove the need to do the prior assert because I could make the cache an optional parameter
  // that is lazily created and assigned if not specified. I could also avoid even exporting the
  // PollContext class itself, and just export the factory function. On the other hand, how does it
  // affect testing? What if I want to, for example, use a custom db? Test behavior in the absence
  // of a cache? etc.

  // Ensure that the connections are not already open
  assert(!this.feedStore.isOpen());
  assert(!this.iconCache.isOpen());

  // This function creates and assigns a new channel. If channel is already defined, that would
  // result in losing the reference to the previous channel. That could mean that the previous
  // channel is left open indefinitely, kind of like a memory leak, so avoid that.

  // See the note:
  // https://html.spec.whatwg.org/multipage/web-messaging.html#dom-broadcastchannel-postmessage
  // Authors are strongly encouraged to explicitly close BroadcastChannel objects when they are no
  // longer needed, so that they can be garbage collected. Creating many BroadcastChannel objects
  // and discarding them while leaving them with an event listener and without closing them can lead
  // to an apparent memory leak, since the objects will continue to live for as long as they have an
  // event listener (or until their page or worker is closed).
  assert(!this.channel);

  // Open both connections concurrently. Allow any errors to bubble up.
  const promises = [this.feedStore.open(), this.iconCache.open()];
  await Promise.all(promises);

  // Create a channel that will be used to broadcast messages such as when a new entry is added to
  // the database.
  this.channel = new BroadcastChannel(CHANNEL_NAME);
};

// Close database connections
PollContext.prototype.close = function() {
  // The if checks are for caller convenience given that close is often called from finally block
  // where I want to be confident no additional exceptions are thrown
  if(this.channel) {
    this.channel.close();
  }

  if(this.feedStore) {
    this.feedStore.close();
  }

  if(this.iconCache) {
    this.iconCache.close();
  }
};

PollContext.prototype.init = function() {
  if(this.feedStore) {
    console.warn('feedStore already initialized, re-initializing anyway');
  }
  this.feedStore = new FeedStore();

  if(this.iconCache) {
    console.warn('iconCache already initialized, re-initializing anyway');
  }
  this.iconCache = new FaviconCache();
};
