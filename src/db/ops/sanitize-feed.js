import assert from '/src/lib/assert.js';
import filter_controls from '/src/lib/filter-controls.js';
import remove_html from '/src/lib/remove-html.js';
import truncate_html from '/src/lib/truncate-html.js';

// TODO: active should be 1/0, not boolean

const props = [
  'id', 'active', 'title', 'type', 'link', 'description', 'deactivation_reason',
  'deactivation_date', 'created_date', 'updated_date', 'published_date',
  'favicon_url', 'urls'
];

export default function sanitize_feed(
    feed, title_max_len = 1024, desc_max_len = 10240) {
  assert(feed && typeof feed === 'object');

  const repl_suffix = '';

  if (feed.title) {
    let title = feed.title;
    title = filter_controls(title);
    title = remove_html(title);
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_len, repl_suffix);
    feed.title = title;
  }

  if (feed.description) {
    let desc = feed.description;
    desc = filter_controls(desc);
    desc = remove_html(desc);
    desc = condense_whitespace(desc);
    desc = truncate_html(desc, desc_max_len, repl_suffix);
    feed.description = desc;
  }
}

function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}
