
/**
 * NOTE: if entry content should be augmented, or entry.link should
 * be re-written, that should happen around the time of the fetch
 * before calling insertFeed or updateFeed. That way we do not need
 * to do it here and deal with passing those parameters.
 */
function mergeEntries(db, feed, oncomplete, onerror) {
  var entriesProcessed = 0, entriesAdded = 0;
  var entries = feed.entries;

  if(!feed.id) {
    return onerror({type:'missing-feed-id',feed:feed});
  }

  // Missing entries is not an error, it simply
  // means we are finished
  if(!entries || !entries.length) {
    return oncomplete(feed, entriesProcessed, entriesAdded);
  }

  var entryCount = entries.length;

  // TODO: create a new array containing the entries to
  // store. Use Array.prototype.map
  // Dont forget to set hash later since now we do
  // this outside of the check
  var storableEntries = entries.map(getStorableEntry);

  // Propagate feed properties to the entries
  // TODO: can i use 'feed' as the thisArg above
  // and do the propagation in getStorableEntry?
  storableEntries.forEach(propagateFeedProperties);

  // Filter out any entries without hash

  var storableEntriesWithHashes = storableEntries.filter(entryHasHash);

  // Count entries without hashes as processed
  var numEntriesWithoutHashes =
    storableEntries.length - storableEntriesWithHashes.length;
  entriesProcessed += numEntriesWithoutHashes;

  // Check here since iteration would not occur
  if(storableEntriesWithHashes.length == 0) {
    return oncomplete(feed, entriesProcessed, entriesAdded);
  }

  // Try to insert the entries, and call oncomplete
  // when done
  // NOTE: if there are ever several thousand entries
  // this could run into an issue with opening too
  // many txs in indexedDB. This is so rare that I am
  // not dealing with it for now.
  // See http://stackoverflow.com/questions/22247614
  storableEntriesWithHashes.forEach(processEntry);

  // TODO: if i set unique:true for the hash index on
  // the entry store, i do not even need to do the extra
  // lookup. right now, addRequest.onerror never even
  // gets called unless omething really strange happens
  // because there are no uniqueness constraintsto violate

  function processEntry(entry) {
    var tx = db.transaction('entry','readwrite');
    var entryStore = tx.objectStore('entry');
    var hashIndex = entryStore.index('hash');

    hashIndex.get(entry.hash).onsuccess = function() {
      if(this.result) {
        return onProcessed();
      }

      var addRequest = entryStore.add(entry);
      addRequest.onerror = onProcessed;
      addRequest.onsuccess = onUpdateSuccess;
    };
  }

  function entryHasHash(entry) {
    return entry.hash;
  }

  function onProcessed() {
    entriesProcessed++;
    if(entriesProcessed >= entryCount) {
      oncomplete(feed, entriesProcessed, entriesAdded);
    }
  }

  function onUpdateSuccess() {
    entriesAdded++;
    onProcessed();
  }

  function propagateFeedProperties(entry) {

    // Cache link and title redundantly per
    // entry for faster display
    if(feed.link) {
      storableEntry.feedLink = feed.link;
    }

    if(feed.title)
      storableEntry.feedTitle = feed.title;

    // Set the foreign key
    storableEntry.feed = feed.id;

    // Fall back to using the feed's pubdate
    // if the entry does not have one.
    if(!storableEntry.pubdate && feed.date) {
      storableEntry.pubdate = feed.date;
    }

  }
}

function getStorableEntry(entry) {
  var output = {};

  // Store a hash property for equality testing
  // and indexed lookup in indexedDB
  output.hash = generateEntryHash(entry);

  // Initialize as unread
  output.unread = 1;

  if(entry.author) {
    output.author = entry.author;
  }

  if(entry.link) {
    output.link = entry.link;
  }

  if(entry.title) {
    output.title = entry.title;
  }

  var pubdate = parseDate(entry.pubdate);
  if(pubdate) {
    output.pubdate = pubdate.getTime();
  }

  output.created = Date.now();

  // We are sanitizing, trimming, and rewriting/resolving urls in real time
  // on render instead of here.
  if(entry.content) {
    output.content = entry.content;
  }

  return output;
}

function generateEntryHash(entry) {
  var seed = entry.link || entry.title || entry.content;
  if(seed) {
    return generateHashCode(seed.split(''));
  }
}