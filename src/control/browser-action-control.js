import * as localStorageUtils from '/src/lib/local-storage-utils.js';
import * as DBService from '/src/service/db-service.js';
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
  const reuseNewtab = localStorageUtils.readBoolean('reuse_newtab');
  openTab('slideshow.html', reuseNewtab).catch(console.warn);
};

BrowserActionControl.prototype.onStartup = async function () {
  const conn = await DBService.open(INDEFINITE);
  await this.refreshBadge(conn);
  conn.close();
};

BrowserActionControl.prototype.onInstalled = async function () {
  // This does not distinguish between install and update event types. While it would seem like we
  // only need to initialize the badge text on install, and update the unread count when the
  // extension is updated, there is also a separate kind of update that happens when the
  // background page is reloaded (through the extensions manager inspector) that without this
  // handler causes the text to be unset.
  const conn = await DBService.open(INDEFINITE);
  await this.refreshBadge(conn);
  conn.close();
};

BrowserActionControl.prototype.onMessage = async function (event) {
  if (!event.isTrusted || !event.data) {
    return;
  }

  const message = event.data;

  // If the message indicates the number of unread entries was possibly modified then update. There
  // is no resource type information available when deleting.
  if ((message.type === 'resource-created' && message.resourceType === 'entry') ||
    (message.type === 'resource-updated' && message.resourceType === 'entry') ||
    message.type === 'resource-deleted') {
    const conn = await DBService.open(INDEFINITE);
    await this.refreshBadge(conn);
    conn.close();
  }
};

BrowserActionControl.prototype.onMessageError = function (event) {
  console.warn(event);
};

BrowserActionControl.prototype.refreshBadge = async function (conn) {
  const count = await DBService.countUnreadEntries(conn);
  const text = count > 999 ? '1k+' : `${count}`;
  chrome.browserAction.setBadgeText({ text });
};

BrowserActionControl.prototype.closeChannel = function () {
  this.channel.close();
};
