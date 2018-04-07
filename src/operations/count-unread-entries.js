import {ENTRY_STATE_UNREAD} from '/src/objects/entry.js';

// TODO: now that I have this operations folder, I am more confident that it
// makes sense to deprecate this call. This is only used by one other module,
// which is also an operation. This should just be a helper to it. There are no
// other users of this function. This is a classic case of trying to design for
// something that is not the actual need, a sort of just-in-case design
// approach, which is wrong. Design for the task at hand, not the possible
// future task.
// Furthermore, if I deprecate and make a helper, I could look more into making
// rdr_badge_update easily unawaitable, because I only need to guarantee the
// request is set while the connection is not close-pending, so that even if the
// caller does close while it is pending, there is no issue, because close
// implicitly waits for pendings to settle.

// Return the number of unread entries in the database
// @param conn {IDBDatabase} an open database connection, required
// @return {Promise} a promise that resolves to the number of unread entries, or
// rejects with a database error
export function count_unread_entries(conn) {
  return new Promise(executor.bind(null, conn));
}

function executor(conn, resolve, reject) {
  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_STATE_UNREAD);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
