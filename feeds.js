/**
 * For manipulating feeds and feed entries
 */

var reader = reader || {};
reader.feeds = {};

/**
 * NOTE: assumes rewriting is enabled
 */
reader.feeds.rewriteEntryLink = function(entry) {
  //entry.originalLink = entry.link;
  entry.link = reader.rewrite.rewriteURL(entry.link);
};

reader.feeds.entryHasLink = function(entry) {
  // return entry instanceof Object && entry.hasOwnProperty('entry');
  return entry.link;
};