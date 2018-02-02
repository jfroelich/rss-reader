// TODO: this creates a circular dependency at the moment
// Therefore this will eventually need to be a part of rdb.js
import {feed_is_feed, feed_is_valid_id} from '/src/rdb.js';

// TODO: include this in places where sanitize is called
// TODO: assert required properties are present
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?

export default function validateFeed(feed) {
  assert(feed_is_feed(feed));

  // If the feed has an id then the id must be valid
  if ('id' in feed && !feed_is_valid_id(feed.id)) {
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
