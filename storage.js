/**
 * Facade for accessing temporary or persistent state of the reader app.
 */
var reader = reader || {};

reader.storage = {};

/**
 * sync
 *
 * NOTE: would reader.settings.isRewritingEnabled be more intuitive?
 */
reader.storage.isRewritingEnabled = function() {
  return localStorage.URL_REWRITING_ENABLED;
};

/**
 * async
 */
reader.storage.findEntryByLinkURL = function(db, url, callback) {
  var linkIndex = db.transaction('entry').objectStore('entry').index('link');
  linkIndex.get(url).onsuccess = function() {
    callback(this.result);
  };
};