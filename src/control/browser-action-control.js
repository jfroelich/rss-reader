import * as DBService from '/src/service/db-service.js';
import * as localStorageUtils from '/src/lib/local-storage-utils.js';
import { INDEFINITE } from '/src/lib/deadline.js';
import openTab from '/src/lib/open-tab.js';

export default class BrowserActionControl {
  static onClicked() {
    const reuseNewtab = localStorageUtils.readBoolean('reuse_newtab');
    openTab('slideshow.html', reuseNewtab).catch(console.warn);
  }

  static async onStartup() {
    const conn = await DBService.open(INDEFINITE);
    await BrowserActionControl.refreshBadge(conn);
    conn.close();
  }

  static async onInstalled() {
    const conn = await DBService.open(INDEFINITE);
    await BrowserActionControl.refreshBadge(conn);
    conn.close();
  }

  static async onMessage(event) {
    if (event.isTrusted && event.data) {
      const message = event.data;
      if ((message.type === 'resource-created' && message.resourceType === 'entry') ||
        (message.type === 'resource-updated' && message.resourceType === 'entry') ||
        message.type === 'resource-deleted') {
        const conn = await DBService.open(INDEFINITE);
        await BrowserActionControl.refreshBadge(conn);
        conn.close();
      }
    }
  }

  static onMessageError(event) {
    console.warn(event);
  }

  static async refreshBadge(conn) {
    const count = await DBService.countUnreadEntries(conn);
    const text = count > 999 ? '1k+' : `${count}`;
    chrome.browserAction.setBadgeText({ text });
  }

  constructor() {
    this.channel = undefined;
  }

  init(bindOnclicked, bindOnInstalled, bindOnStartup) {
    this.channel = new BroadcastChannel('reader');
    this.channel.addEventListener('message', BrowserActionControl.onMessage);
    this.channel.addEventListener('messageerror', BrowserActionControl.onMessageError);

    if (bindOnclicked) {
      chrome.browserAction.onClicked.addListener(BrowserActionControl.onClicked);
    }

    if (bindOnInstalled) {
      chrome.runtime.onInstalled.addListener(BrowserActionControl.onInstalled);
    }

    if (bindOnStartup) {
      chrome.runtime.onStartup.addListener(BrowserActionControl.onStartup);
    }
  }

  closeChannel() {
    this.channel.close();
  }
}
