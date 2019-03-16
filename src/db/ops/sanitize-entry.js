import {assert} from '/src/assert.js';
import {is_entry} from '/src/db/types/entry.js';
import filter_controls from '/src/db/utils/filter-controls.js';
import filter_unprintables from '/src/db/utils/filter-unprintables.js';
import remove_html from '/src/db/utils/remove-html.js';
import truncate_html from '/src/db/utils/truncate-html.js';

// TODO: constraints should come from config? or at least as a grouped parameter
// object named constraints?

export default function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  assert(is_entry(entry));

  if (entry.author) {
    let author = entry.author;
    author = filter_controls(author);
    author = remove_html(author);
    author = condense_whitespace(author);
    author = truncate_html(author, author_max_length);
    entry.author = author;
  }

  if (entry.content) {
    let content = entry.content;
    content = filter_unprintables(content);
    entry.content = content;
  }

  if (entry.title) {
    let title = entry.title;
    title = filter_controls(title);
    title = remove_html(title);
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_length);
    entry.title = title;
  }
}

function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}
