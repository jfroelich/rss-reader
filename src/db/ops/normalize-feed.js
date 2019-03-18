import {is_feed} from '/src/db/object/feed.js';
import assert from '/src/lib/assert.js';

// NOTE: no accompanying test module because it is redundant with
// normalize-entry
// TODO: maybe it would work out better to have normalize-resource since both
// entry and feed are subtypes (append-url-common would also fit in resource,
// and resource would be an abstract type (throw error in constructor)).

export default function normalize_feed(feed) {
  assert(is_feed(feed));

  // For comments on normalization see the normalize-entry implementation
  // We do not normalize urls because append-url takes care of that

  if (feed.title) {
    feed.title = feed.title.normalize();
  }

  if (feed.description) {
    feed.description = feed.description.normalize();
  }
}
