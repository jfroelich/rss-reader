// Feed validation module

import assert from "/src/assert.js";
import {check} from "/src/errors.js";
import {isPosInt} from "/src/number.js";
import * as Feed from "/src/feed.js";

// TODO: include this in places where sanitize is called
// TODO: assert required properties are present
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?
export default function validateFeed(feed) {
  // Unlike the other error handling, passing a non-feed value to this function is indicative of a
  // programming error.
  assert(Feed.isFeed(feed));

  if('id' in feed) {
    check(isPosInt(feed.id));
  }

  if('type' in feed) {
    const types = ['feed', 'rss', 'rdf'];
    check(types.includes(feed.type));
  }
}
