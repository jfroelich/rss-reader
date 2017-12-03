import assert from "/src/assert/assert.js";
import FaviconCache from "/src/favicon/cache.js";
import openReaderDb from "/src/reader-db/open.js";
import {close as closeDb, isOpen as isOpenDb} from "/src/utils/indexeddb-utils.js";

// BUG: loopback messages are not handled correctly, so polling from slideshow context will not
// trigger listener call. To fix it I guess I have to handcraft a separate, redundant channel
// mechanism? Rather than redundant, I mean substitute?
// TODO: check if the above bug is fixed, I think last time I checked this was like 1000 Chrome
// builds ago. I believe there is still a loopback channel test in experimental.
// NOTE: I believe the bug is fixed, just got a working message when polling from slideshow
// TODO: before I delete these comments, cleanup options page, and the loopback test, because I
// think the bug is gone now. Probably also need to check github to see if I created some issue
// about this and close it.


// TODO: this should probably be defined externally, because multiple modules are concerned with
// either sending or receiving messages from and to this channel
const CHANNEL_NAME = 'reader';

// TODO: consider that some of these defaults should come from the global config file?

// A PollContext is a basic function object that is intended to be used when calling pollFeed or
// pollFeeds. It helps simplify the number of arguments that each function needs. It is a function
// instead of a simple object to allow for simple allocation (use of "new").
export default function PollContext() {
  // {IDBDatabase} a connection to the reader database
  this.readerConn = undefined;

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
  // The caller is responsible for wiring up an instance of FaviconCache prior to opening the
  // context.
  assert(this.iconCache instanceof FaviconCache);

  // TODO: if the open stuff happened as part of the construction of the context, then there would
  // be no risk of duplicate stuff happening, like duplicate calls to open, or the context being
  // in an incorrect state prior to calling open. However I cannot use async constructor. So this
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
  assert(!isOpenDb(this.readerConn));
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

  // Open both connections concurrently
  const promises = [openReaderDb(), this.iconCache.open()];
  // Wait for both connections to finish opening.
  // Allow any errors to bubble up.
  // Use partial destructuring. Grab the reader connection from the resolutions array but ignore
  // the iconCache result.
  [this.readerConn] = await Promise.all(promises);

  // Create a channel that will be used to broadcast messages such as when a new entry is added to
  // the database.
  this.channel = new BroadcastChannel(CHANNEL_NAME);
};

// Close database connections
PollContext.prototype.close = function() {
  // The if checks are for caller convenience given that close is often called from finally block
  if(this.channel) {
    this.channel.close();
  }

  if(this.iconCache) {
    this.iconCache.close();
  }

  closeDb(this.readerConn);
};

// This is a simple helper function that in some cases helps the caller avoid the need to explicitly
// create and link a FaviconCache, which in turn basically allows the caller to avoid even importing
// the FaviconCache (assuming it is of course not in use in the module for other reasons).
// I currently have mixed feelings about initializing this in the constructor, because of things
// like inversion of control, dependency injection, etc, so I've added this for now but I may
// decide to just deprecate it eventually.
PollContext.prototype.initFaviconCache = function() {
  this.iconCache = new FaviconCache();
};
