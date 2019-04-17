import * as config from '/src/config.js';
import * as rss from '/src/service/resource-storage-service.js';
import { INDEFINITE } from '/src/lib/deadline.js';
import openTab from '/src/lib/open-tab.js';

export default function BrowserActionControl() {
  this.channel = undefined;
}

BrowserActionControl.prototype.init = function (bindOnclicked, bindOnInstalled, bindOnStartup) {
  this.channel = new BroadcastChannel('reader');
  this.channel.addEventListener('message', this.onMessage.bind(this));
  this.channel.addEventListener('messageerror', this.onMessageError.bind(this));

  if (bindOnclicked) {
    chrome.browserAction.onClicked.addListener(this.onClicked.bind(this));
  }

  if (bindOnInstalled) {
    chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
  }

  if (bindOnStartup) {
    chrome.runtime.onStartup.addListener(this.onStartup.bind(this));
  }
};

BrowserActionControl.prototype.onClicked = function () {
  const reuseNewtab = config.readBoolean('reuse_newtab');
  openTab('slideshow.html', reuseNewtab).catch(console.warn);
};

BrowserActionControl.prototype.onStartup = async function () {
  const conn = await rss.open(INDEFINITE);
  this.refreshBadge(conn).catch(console.warn);
  conn.close();
};

BrowserActionControl.prototype.onInstalled = async function () {
  // This does not distinguish between install and update event types. While it would seem like we
  // only need to initialize the badge text on install, and update the unread count when the
  // extension is updated, there is also a separate kind of update that happens when the
  // background page is reloaded (through the extensions manager inspector) that without this
  // handler causes the text to be unset.
  const conn = await rss.open(INDEFINITE);
  this.refreshBadge(conn).catch(console.warn);
  conn.close();
};

BrowserActionControl.prototype.onMessage = async function (event) {
  if (!event.isTrusted || !event.data) {
    return;
  }

  // TODO: the model should broadcast the resource type, and this should only handle the situation
  // where the resource type is 'entry'
  const types = ['resource-created', 'resource-updated', 'resource-deleted'];
  if (types.includes(event.data.type)) {
    const conn = await rss.open(INDEFINITE);
    await this.refreshBadge(conn);
    conn.close();
  }
};

BrowserActionControl.prototype.onMessageError = function (event) {
  console.warn('Message error event:', event);
};

BrowserActionControl.prototype.refreshBadge = async function (conn) {
  const count = await rss.countUnreadEntries(conn);

  const text = count > 999 ? '1k+' : `${count}`;
  chrome.browserAction.setBadgeText({ text });
};

BrowserActionControl.prototype.closeChannel = function () {
  this.channel.close();
};
