import {create_entry} from '/src/entry.js';
import {replace_tags} from '/src/lib/html/replace-tags.js';
import {truncate_html} from '/src/lib/html/truncate-html.js';
import {condense_whitespace} from '/src/lib/lang/condense-whitespace.js';
import {filter_control_characters} from '/src/lib/lang/filter-control-characters.js';
import {filter_unprintable_characters} from '/src/lib/lang/filter-unprintable-characters.js';

// Returns a new entry object where fields have been sanitized. Impure. Note
// that this assumes the entry is valid. As in, passing the entry to
// is_valid_entry before calling this function would return true. This does not
// revalidate. Sanitization is not validation. Here, sanitization acts more like
// a normalizing procedure, where certain properties are modified into a more
// preferable canonical form. A property can be perfectly valid, but
// nevertheless have some undesirable traits. For example, a string is required,
// but validation places no maximum length constraint on it, just required-ness,
// but sanitization also places a max length constraint on it and does the
// necessary changes to bring the entry into compliance via truncation.
export function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  // Create a shallow clone for purity
  const blank_entry = create_entry();
  const output_entry = Object.assign(blank_entry, entry);

  if (output_entry.author) {
    let author = output_entry.author;
    author = filter_control_characters(author);
    author = replace_tags(author, '');
    author = condense_whitespace(author);
    author = truncate_html(author, author_max_length);
    output_entry.author = author;
  }

  if (output_entry.content) {
    let content = output_entry.content;
    content = filter_unprintable_characters(content);
    content = truncate_html(content, content_max_length);
    output_entry.content = content;
  }

  if (output_entry.title) {
    let title = output_entry.title;
    title = filter_control_characters(title);
    title = replace_tags(title, '');
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_length);
    output_entry.title = title;
  }

  return output_entry;
}
