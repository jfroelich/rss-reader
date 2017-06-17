// See license.md

'use strict';


async function jrFeedIconCreateAlarm(periodInMinutes) {
  const alarm = await jrUtilsGetAlarm('refresh-feed-icons');
  if(alarm)
    return;
  chrome.alarms.create('refresh-feed-icons',
    {'periodInMinutes': periodInMinutes});
}

function jrFeedIconRegisterAlarmListener() {
  chrome.alarms.onAlarm.addListener(jrFeedIconOnAlarm);
}

async function jrFeedIconOnAlarm(alarm) {
  if(alarm.name !== 'refresh-feed-icons')
    return;

  try {
    await jrFeedIconRefresh();
  } catch(error) {
    console.warn(error);
  }
}

async function jrFeedIconRefresh() {
  let numModified = 0;

  try {
    const connections = await Promise.all([this.readerDb.jrDbConnect(),
      jrFaviconConnect()]);
    this.feedStore.conn = connections[0];
    const feeds = await this.feedStore.getAll();
    const updatePromises = feeds.map(jrFeedIconUpdateIcon, this);
    const resolutions = await Promise.all(updatePromises);
    numModified = resolutions.reduce((c, r) => r ? c + 1 : c, 0);
  } finally {
    this.fs.close();
    if(this.feedStore.conn)
      this.feedStore.conn.close();
  }
}

async function jrFeedIconUpdateIcon(feed) {
  const lookupURL = FeedFavicon.getLookupURL(feed);
  const iconURL = await jrFaviconLookup(lookupURL);
  if(!iconURL)
    return false;
  if(feed.faviconURLString === iconURL)
    return false;

  feed.faviconURLString = iconURL;
  await jrDbPutFeed(feed);
  return true;
}

function jrFeedIconGetLookupURL(feed) {
  // Cannot assume the link is set nor valid
  if(feed.link) {
    try {
      return new URL(feed.link);
    } catch(error) {
      console.warn(error);
    }
  }

  // If the link is missing or invalid then use the origin
  const feedURL = jrFeedGetURL(feed);
  const origin = new URL(feedURL).origin;
  return new URL(origin);
}
