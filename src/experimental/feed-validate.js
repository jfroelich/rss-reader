import assert from "/src/assert.js";
import {check} from "/src/utils/errors.js";
import * as Feed from "/src/reader-db/feed.js";

// TODO: include this in places where sanitize is called
// TODO: assert required properties are present
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?


export default function validateFeed(feed) {
  // Unlike the other error handling, passing a non-feed value to this function is indicative of a
  // programming error.
  assert(Feed.isFeed(feed));

  // id must either be not set, or a valid feed id
  check(!('id' in feed) || isValidId(feed.id));

  if('type' in feed) {
    const types = ['feed', 'rss', 'rdf'];
    check(types.includes(feed.type));
  }
}
