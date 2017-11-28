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

  // {Boolean} Whether to accept an html mime type when fetching a feed
  this.acceptHTML = true;

  // {Boolean} If true, this signals to pollFeed that it is being called concurrently
  this.batchMode = true;
}
