import assert from "/src/assert/assert.js";
import {showNotification} from "/src/platform/platform.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import pollFeed from "/src/jobs/poll/poll-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import getFeedsFromDb from "/src/reader-db/get-feeds.js";
import promiseEvery from "/src/utils/promise-every.js";

// TODO: pollFeeds is a job, but pollFeed no longer is a job, it is now a shared module that is
// also used by subscribe to get a feed's entries.

// TODO: sending a BroadcastChannel message when polling completes is pointless. The event is not
// significant because it represents too many things that may have just happened. This should
// only be broadcasting interesting, granular events. For example, when an entry is added, or
// when a feed's details change in the database or something. Furthermore, the responsibility for
// broadcasting that message no longer feels like it is a concern of polling, but rather a concern
// for whatever lower level function is doing something. E.g. putEntry or whatever in the database
// can broadcast a message when an entry is added, and that means polling does not need to do.
// In the interim, I removed the poll broadcast channel

export default async function pollFeeds() {
  assert(this instanceof PollContext);

  // Ensure that batch mode is on. This overrides whatever custom setting was used. The default
  // is false, so this has to happen. It seems reasonable to do it here because calling pollFeeds
  // indicates batch mode implicitly, and I chose to use batch mode as a context flag instead of
  // a parameter to the pollFeed function to make it simpler to call pollFeed. Setting it here also
  // simplifies calling pollFeeds as the caller does not need to be concerned with setting it.
  this.batchMode = true;

  // Get all feeds from the database
  const feeds = await getFeedsFromDb(this.readerConn);
  // Concurrently poll each feed
  const promises = feeds.map(pollFeed, this);
  // Wait for all feed poll operations to complete
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
