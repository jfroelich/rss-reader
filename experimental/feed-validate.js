// TODO: this creates a circular dependency at the moment
// Therefore this will eventually need to be a part of rdb/rdb.js
import {rdb_is_feed, rdb_feed_is_valid_id} from '/src/rdb/rdb.js';

// TODO: include this in places where sanitize is called
// TODO: assert required properties are present
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?

export default function validateFeed(feed) {
  assert(rdb_is_feed(feed));

  // If the feed has an id then the id must be valid
  if ('id' in feed && !rdb_feed_is_valid_id(feed.id)) {
    throw new Error('Invalid feed id ' + feed.id);
  }

  const types = ['feed', 'rss', 'rdf'];
  if ('type' in feed && !types.includes(feed.type)) {
    throw new Error('Invalid feed type ' + feed.type);
  }
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
