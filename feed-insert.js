


/**
 * This can be called in three contexts:
 * 1 Subscribe while online. The feed must be fetched by the caller
 * and then passed in.
 * 2 Subscribe while offline. Just pass in {url:url}
 * 3 Batch import from OPML. Just pass in {url:url}
 *
 * If subscribing while offline then just
 * If importing, then just pass in {url:url}
 *
 * All contexts need to pass in a db parameter, because some contexts want to
 * use the same connection across multiple calls.
 *
 * All contexts must ensure feed.url is defined, trimmed, ready for comparing to
 * other urls (but with scheme), and ready for storage. This function does not
 * modify the url given.
 *
 * In any context, it is this function's responsibility to ensure that:
 * - it is a new feed
 * - to prepare the feed for storage
 * - to set the properties about storage (feed.datecreated)
 *
 * When this is done it possibly called mergeEntries with oncomplete as the callback
 * from that. it also sets feedId before doing it. It also checks if there are no
 * entries since it could be called from import/offline subscribe context.
 *
 * mergeEntries is shared by both updateFeed and insertFeed
 *
 * TODO: the check for existing is basically a call to another function,
 * findFeedBySchemelessURL.
 * TODO: this check could be skipped if I change the insert request to fail
 * because it violates the uniqueness constraint on the schemeless url property
 * in indexedDB. So I would need to change the flag to createIndex for the
 * schemeless index to unique:true.
 *
 * It makes sense to check uniqueness here, it is this function's responsibility,
 * because an insert should never happen if a similar feed already exists.
 *
 */
function insertFeed(db, feed, oncomplete, onerror) {
  console.log('insertFeed url %s', feed.url);

  if(!feed.url) {
    onerror({type:'invalid-url',url:feed.url});
  } else {
    findFeedBySchemelessURL(db, feed.url, onFindFeed);
  }

  function onFindFeed(existingFeed) {
    if(existingFeed) {
      return onerror({type:'exists',url:feed.url});
    }

    var storableFeed = getStorableFeed(feed);
    storableFeed.created = Date.now();
    var feedStore = db.transaction('feed','readwrite').objectStore('feed');
    var request = feedStore.add(storableFeed);
    request.onsuccess = onInsertSuccess;
  }

  function onInsertSuccess() {
    storableFeed.id = this.result;
    storableFeed.entries = feed.entries;
    mergeEntries(db, storableFeed, onEntriesMerged, onerror);
  }

  function onEntriesMerged(entriesProcessed, entriesAdded) {

    oncomplete(storableFeed, entriesAdded);

    // This gets called in every context (import/sub offline/subonline),
    // so it makes sense to dispatch from here
    chrome.runtime.sendMessage({type:'subscribe',feed:storableFeed});

    // TODO: this does not belong here. The caller should do this in
    // the oncomplete function. That way import can do a single batch
    // and subscribe to one (offline or online) can do a per subscribe
    // if(notify) {
      //showNotification('Subscribed to '+storableFeed.title+'. Found '+entriesAdded+' new articles.');
    //}
  }
}