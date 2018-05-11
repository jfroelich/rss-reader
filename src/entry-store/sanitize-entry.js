import {create_entry} from '/src/entry-store/entry.js';
import {html_truncate} from '/src/lib/html-truncate.js';
import {html_replace_tags} from '/src/lib/html.js';
import {filter_empty_properties} from '/src/lib/object.js';
import * as string from '/src/lib/string.js';

// TODO: review whether filtering empty properties should be implicit in
// sanitization or instead an explicit concern of the caller that is reframed as
// some more general concern of reducing object storage size. Answer the
// question of whether removing empty properties is a concern of sanitization.
// For now it is simply because I want to maintain the behavior that was
// previously in place before integrating it here.

// TODO: review where the defaults should come from? Kind of app policy.
// So whatever is calling this should probably be explicit. So maybe leave the
// defaults as is, the concern is for the caller not us.

// TODO: use an options variable to group the other parameters and reduce the
// number of parameters and increase flexibility?

// TODO: this should assert against the input entry, checking is_entry

// TODO: review again the todos in string lib, note the similarity between
// filtering filter_unprintable_characters and filter_control_characters, it
// really seems strange here and unclear why there is a distinction. At least
// describe the distinction, and then think about doing away with it.

// TODO: maybe this should not clone, and become impure. Then the caller can
// decide to call this on a clone, so the caller can decide whether to clone,
// so the caller has more flexibility, and can opt into a more optimized path.
// Right now the purity concern places the constraint on the caller without any
// choice by the caller. Doing something like having a "should clone" parameter
// just feels even more backward. And, although we should pretend not to know,
// we know the caller does not need to clone in the sole use case of this
// function at the moment, so this cloning concern here is truly pedantic.

// TODO: update docs

export function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  const blank_entry = create_entry();
  const output_entry = Object.assign(blank_entry, entry);

  if (output_entry.author) {
    let author = output_entry.author;
    author = string.filter_control_characters(author);
    author = html_replace_tags(author, '');
    author = string.condense_whitespace(author);
    author = html_truncate(author, author_max_length);
    output_entry.author = author;
  }

  if (output_entry.content) {
    let content = output_entry.content;
    content = string.filter_unprintable_characters(content);
    content = html_truncate(content, content_max_length);
    output_entry.content = content;
  }

  if (output_entry.title) {
    let title = output_entry.title;
    title = string.filter_control_characters(title);
    title = html_replace_tags(title, '');
    title = string.condense_whitespace(title);
    title = html_truncate(title, title_max_length);
    output_entry.title = title;
  }

  return filter_empty_properties(output_entry);
}
