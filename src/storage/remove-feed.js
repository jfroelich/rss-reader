import assert from "/src/assert.js";
import {isValidId as isValidFeedId} from "/src/storage/feed.js";
import {isOpen} from "/src/utils/indexeddb-utils.js";

// TODO: this should not accept entryIds as parameter, it should find the entries as part of the
// transaction implicitly. Once that it done there is no need to assert against entryIds as
// valid entry ids.

export default function removeFeed(conn, feedId, entryIds) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    assert(isValidFeedId(feedId));
    assert(Array.isArray(entryIds));

    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const feedStore = tx.objectStore('feed');
    feedStore.delete(feedId);

    const entryStore = tx.objectStore('entry');
    for(const id of entryIds) {
      entryStore.delete(id);
    }
  });
}
