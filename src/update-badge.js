// See license.md

'use strict';

{

function update_badge(conn, log) {
  const db = new FeedDb(log || SilentConsole);
  const ctx = {
    'conn': conn,
    'text': '?',
    'log': log || SilentConsole,
    'db': db
  };
  ctx.log.log('Updating badge unread count');
  if(conn)
    db_count_unread_entries(ctx.log, conn, on_count_unread.bind(ctx));
  else
    db.connect(connect_on_success.bind(ctx), connect_on_error.bind(ctx));
}

function connect_on_success(conn) {
  this.log.log('Connected to database %s to update badge', this.db.name);
  db_count_unread_entries(this.log, conn, on_count_unread.bind(this));
  conn.close();
}

function connect_on_error() {
  this.text = 'ERR';
  onComplete.call(this);
}

function on_count_unread(count) {
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

this.update_badge = update_badge;

}
