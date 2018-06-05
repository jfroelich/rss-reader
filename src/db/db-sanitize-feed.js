import {replace_tags} from '/src/lib/html/replace-tags.js';
import {truncate_html} from '/src/lib/html/truncate-html.js';
import {condense_whitespace} from '/src/lib/lang/condense-whitespace.js';
import {filter_control_characters} from '/src/lib/lang/filter-control-characters.js';


// TODO: drop the db prefix, the name is a concern of an importing module and
// not a concern of the exporting module, and the prefix is an overqualification

// Cleans/normalizes certain properties of the feed
export function db_sanitize_feed(feed, options) {
  options = options || {};
  const title_max_len = options.title_max_len || 1024;
  const desc_max_len = options.desc_max_len || 1024 * 10;

  const html_tag_replacement = '';
  const repl_suffix = '';

  if (feed.title) {
    let title = feed.title;
    title = filter_control_characters(title);
    title = replace_tags(title, html_tag_replacement);
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_len, repl_suffix);
    feed.title = title;
  }

  if (feed.description) {
    let desc = feed.description;
    desc = filter_control_characters(desc);
    desc = replace_tags(desc, html_tag_replacement);
    desc = condense_whitespace(desc);
    desc = truncate_html(desc, desc_max_len, repl_suffix);
    feed.description = desc;
  }
}
