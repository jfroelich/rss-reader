import assert from "/src/assert/assert.js";
import {showNotification} from "/src/platform/platform.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import pollFeed from "/src/jobs/poll/poll-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import getActiveFeedsFromDb from "/src/reader-db/get-active-feeds.js";
import promiseEvery from "/src/promise/every.js";

export default async function pollFeeds() {
  assert(this instanceof PollContext);

  // The caller is responsible for wiring up a valid channel. If the channel is defined it is open
  assert(this.channel instanceof BroadcastChannel);

  // Ensure that batch mode is on. This overrides whatever custom setting was used. The default
  // is false, so this has to happen. It seems reasonable to do it here because calling pollFeeds
  // indicates batch mode implicitly, and I chose to use batch mode as a context flag instead of
  // a parameter to the pollFeed function to make it simpler to call pollFeed. Setting it here also
  // simplifies calling pollFeeds as the caller does not need to be concerned with setting it.
  this.batchMode = true;

  // Get all active feeds from the database
  const feeds = await getActiveFeedsFromDb(this.readerConn);
  // Concurrently poll each feed
  const promises = feeds.map(pollFeed, this);
  // Wait for all feed poll operations to settle
  const pollFeedResolutions = await promiseEvery(promises);

  // Get the total entries added. pollFeed returns the number of entries added, or throws an error.
  // If it throws an error, promiseEvery stores an undefined value in the output array. Therefore,
  // iterate over the resolutions checking if the value is defined. This is done using the simple
  // truthy condition test, which is false for 0, but not adding 0 is fine.
  let totalNumEntriesAdded = 0;
  for(const res of pollFeedResolutions) {
    if(res) {
      totalNumEntriesAdded += res;
    }
  }

  // Regardless of batch mode, refresh the unread count of the extension's badge
  if(totalNumEntriesAdded > 0) {
    await updateBadgeText(this.readerConn);
  }

  // Regardless of batch mode, show a notification if entries were addded
  if(totalNumEntriesAdded > 0) {
    const title = 'Added articles';
    const message = 'Added articles';
    showNotification(title, message);
  }
}
