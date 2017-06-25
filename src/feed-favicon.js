// See license.md

'use strict';


async function jrFeedIconCreateAlarm(periodInMinutes) {
  const alarm = await utils.getAlarm('refresh-feed-icons');
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
    const connections = await Promise.all([this.readerDb.db.connect(),
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

async function jrFeedIconUpdateIcon(feedObject) {
  const lookupURL = FeedFavicon.getLookupURL(feedObject);
  const iconURL = await jrFaviconLookup(lookupURL);
  if(!iconURL)
    return false;
  if(feedObject.faviconURLString === iconURL)
    return false;

  feedObject.faviconURLString = iconURL;
  await db.putFeed(feedObject);
  return true;
}

function jrFeedIconGetLookupURL(feedObject) {
  // Cannot assume the link is set nor valid
  if(feedObject.link) {
    try {
      return new URL(feedObject.link);
    } catch(error) {
      console.warn(error);
    }
  }

  // If the link is missing or invalid then use the origin
  const feedURL = feed.getURLString(feedObject);
  const origin = new URL(feedURL).origin;
  return new URL(origin);
}
