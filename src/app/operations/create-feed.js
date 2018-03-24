import {feed_is_valid, feed_prepare} from '/src/app/objects/feed.js';
import {update_feed} from '/src/app/operations/update-feed.js';
import * as rdb from '/src/rdb/rdb.js';

// TODOS
// * documentation
// * relocate helpers and deprecrate rdb, move functions that are only in use
// here as private helpers here, part of giving up on storage layer and instead
// focusing on high-coherency operations layer, look at zircon syscalls api and
// implementation as api-design reference example
// * testing that focuses exclusively on create_feed
// * the prep stuff and validation stuff should probably be isolated somewhere
// and not specific to rdb, somewhere under app, maybe as part of an objects
// folder, as helper to feed objects
// * consider being redundant and not delegating to update_feed
// * channel post stuff should probably be abstracted away a bit eventually

// Create a new feed in storage
export async function create_feed(conn, channel, feed) {
  assert(feed_is_valid(feed));

  const prepared_feed = feed_prepare(feed);
  prepared_feed.active = true;
  prepared_feed.dateCreated = new Date();
  delete prepared_feed.dateUpdated;

  let void_channel;
  const validate = false;
  const feed_id =
      await update_feed(conn, void_channel, prepared_feed, validate);

  if (channel) {
    channel.postMessage({type: 'feed-added', id: feed_id});
  }

  prepared_feed.id = feed_id;
  return prepared_feed;
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
