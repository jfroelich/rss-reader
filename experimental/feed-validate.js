import assert from '/src/common/assert.js';

// TODO: this creates a circular dependency at the moment
import {isFeed, isValidFeedId} from '/src/rdb.js';

// TODO: include this in places where sanitize is called
// TODO: assert required properties are present
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?


export default function validateFeed(feed) {
  assert(isFeed(feed));

  // If the feed has an id then the id must be valid
  if ('id' in feed && !isValidFeedId(feed.id)) {
    throw new Error('Invalid feed id ' + feed.id);
  }

  const types = ['feed', 'rss', 'rdf'];
  if ('type' in feed && !types.includes(feed.type)) {
    throw new Error('Invalid feed type ' + feed.type);
  }
}
