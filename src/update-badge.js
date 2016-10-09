// See license.md

'use strict';

{

function updateBadge(conn, verbose) {
  const log = new LoggingService();
  log.enabled = verbose;

  log.log('Updating badge unread count');
  const ctx = {'conn': conn, 'text': '?'};
  if(conn) {
    countUnread.call(ctx);
  } else {
    const db = new FeedDb();
    db.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
  }
}

function openDBOnSuccess(event) {
  this.log.log('Connected to database');
  this.conn = event.target.result;
  this.shouldCloseDB = true;
  countUnread.call(this);
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this);
}

function countUnread() {
  const tx = this.conn.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(Entry.flags.UNREAD);
  request.onsuccess = countOnSuccess.bind(this);
  request.onerror = countOnError.bind(this);
  if(this.shouldCloseDB) {
    this.conn.close();
  }
}

function countOnSuccess(event) {
  const count = event.target.result;
  this.log.log('Counted %s unread entries', count);
  if(count > 999) {
    this.text = '1k+';
  } else {
    this.text = '' + event.target.result;
  }
  onComplete.call(this);
}

function countOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this);
}

function onComplete() {
  this.log.log('Setting badge text to', this.text);
  chrome.browserAction.setBadgeText({'text': this.text});
}

this.updateBadge = updateBadge;

}
