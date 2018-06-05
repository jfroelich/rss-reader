// TODO: deprecate, create and use get-entry(mode:url, url, key-only:true)
// instead
// TODO: revert to resolve on request success, the delay until txn is pointless

// Searches the entry store in the database for an entry that contains the given
// url. This is not the same as the similarly-named `find_entry_by_url` function
// (which happens to not exist because there is no need for it at the moment).
// The important feature here, and part of this operation's namesake and
// raison-d'etre, is that we get the entry id (the key) from the url index on
// the entry object store, without deserializing the entry object (loading the
// object into memory). This operation's primary concern is answering the
// question of whether an entry with a given url exists, not retrieving the
// value of an entry.
// @param url {URL}
// @throws {TypeError} (e.g. not a url)
// @throws {DOMException} database error (e.g. connection is closed, database
// does not exist, bad state)
// @return {Promise} returns a promise that resolves to the matching entry id
// {Number}. If no matching entry is found, resolves to undefined.
export function find_entry_id_by_url(conn, url) {
  return new Promise((resolve, reject) => {
    let entry_id;
    const txn = conn.transaction('entry');
    txn.oncomplete = _ => resolve(entry_id);
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = _ => entry_id = request.result;
  });
}