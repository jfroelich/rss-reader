// See license.md

'use strict';

{

function updateBadge(conn, log) {
  log = log || SilentConsole;
  log.log('Updating badge unread count');

  const db = new FeedDb(SilentConsole);
  const cache = new FeedCache(SilentConsole);

  const ctx = {'conn': conn, 'text': '?', 'log': log, 'cache': cache};
  if(conn) {
    cache.countUnread(conn, onCountUnread.bind(ctx));
  } else {
    db.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
  }
}

function openDBOnSuccess(event) {
  this.log.log('Connected to database');
  this.conn = event.target.result;
  this.cache.countUnread(this.conn, onCountUnread.bind(this));
  this.conn.close();
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  this.text = 'ERR';
  onComplete.call(this);
}

function onCountUnread(count) {
  this.log.log('Counted %s unread entries', count);
  if(count > 999) {
    this.text = '1k+';
  } else if(count < 0) {
    this.text = 'ERR';
  } else {
    this.text = '' + count;
  }
  onComplete.call(this);
}

function onComplete() {
  this.log.log('Setting badge text to', this.text);
  chrome.browserAction.setBadgeText({'text': this.text});
}

this.updateBadge = updateBadge;

}
