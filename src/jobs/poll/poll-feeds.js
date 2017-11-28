import assert from "/src/assert.js";
import {showNotification} from "/src/extension.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import pollFeed from "/src/jobs/poll/poll-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import getFeedsFromDb from "/src/reader-db/get-feeds.js";
import promiseEvery from "/src/utils/promise-every.js";

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

  // Get all feeds from the database
  const feeds = await getFeedsFromDb(this.readerConn);
  // Concurrently poll each feed
  const promises = feeds.map(pollFeed, this);
  // Wait for all feed poll operations to complete
  await promiseEvery(promises);

  // This happens regardless of the batch mode setting, because calling this implies batch mode.
  // While it would probably be better implemented as a parameter to pollFeed, this way avoids the
  // need to use an explict bind or care about parameter order when mapping above.
  // TODO: this should conditionally be called, only if the number of entries added is > 0.
  await updateBadgeText(this.readerConn);

  // TODO: this notification could be more informative, should report the number of articles added
  // like I did before. In order to do that, I need to modify pollFeed to return the number of
  // articles added for that feed, then collect the resolutions of the promises above, and then
  // derive the sum from the resolutions.

  // Only send a notification if in batch mode. In non-batch mode, pollFeed does notifications
  if(this.batchMode) {
    const title = 'Added articles';
    const message = 'Added articles';
    showNotification(title, message);
  }

}
