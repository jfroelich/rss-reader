export default function PollFeedsContext() {
  this.readerConn = undefined;
  this.iconCache = undefined;
  this.ignoreRecencyCheck = false;
  this.ignoreModifiedCheck = false;
  this.recencyPeriodMs = 5 * 60 * 1000;
  this.fetchFeedTimeoutMs = 5000;
  this.fetchHTMLTimeoutMs = 5000;
  this.fetchImageTimeoutMs = 3000;
  this.acceptHTML = true;

  // If true, this signals to pollFeed that it is being called multiple times
  this.batchMode = true;
}
