import assert from '/src/lib/assert.js';

// TODO: maybe it would work out better to have normalize-resource since both
// entry and feed are subtypes

export default function normalize_feed(feed) {
  assert(feed && typeof feed === 'object');

  // For comments on normalization see the normalize-entry implementation
  // We do not normalize urls because append-url takes care of that

  if (feed.title) {
    feed.title = feed.title.normalize();
  }

  if (feed.description) {
    feed.description = feed.description.normalize();
  }
}
