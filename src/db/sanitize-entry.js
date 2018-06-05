import {create_entry} from '/src/entry.js';
import {replace_tags} from '/src/lib/html/replace-tags.js';
import {truncate_html} from '/src/lib/html/truncate-html.js';
import {condense_whitespace} from '/src/lib/lang/condense-whitespace.js';
import {filter_control_characters} from '/src/lib/lang/filter-control-characters.js';
import {filter_unprintable_characters} from '/src/lib/lang/filter-unprintable-characters.js';

// TODO: give up on cloning purity, just modify input. if the caller wants to
// clone they can instead clone before, then call on clone

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

// TODO: note the similarity between filtering filter_unprintable_characters and
// filter_control_characters, it really seems strange here and unclear why there
// is a distinction. At least describe the distinction, and then think about
// doing away with it.

// TODO: (similar as above, moved from other file) in sanitize_entry, now that
// filter_unprintable_characters exists, I want to also filter such characters
// from input strings like author/title/etc. However it overlaps with the call
// to filter_control_characters here. There is some redundant work going on.
// Also, in a sense, filter_control_characters is now inaccurate. What I want is
// one function that strips binary characters except important ones, and then a
// second function that replaces or removes certain important binary characters
// (e.g. remove line breaks from author string). Something like
// 'string_replace_formatting_characters'.

// TODO: maybe this should not clone, and become impure. Then the caller can
// decide to call this on a clone, so the caller can decide whether to clone,
// so the caller has more flexibility, and can opt into a more optimized path.
// Right now the purity concern places the constraint on the caller without any
// choice by the caller. Doing something like having a "should clone" parameter
// just feels even more backward. And, although we should pretend not to know,
// we know the caller does not need to clone in the sole use case of this
// function at the moment, so this cloning concern here is truly pedantic.

// TODO: i think this would read more clearly with helpers per property


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
  // Internal implementation note:  Create a shallow clone of the entry. This is
  // partly the source of impurity. Here shallow refers to the fact that several
  // of the properties are objects where the reference to the object is copied,
  // instead of copying the entire value as a new object. Which basically means
  // the new properties point to the old properties. Which basically means to be
  // careful about doing things like modifying the urls property of the input
  // entry after the sanitize call, because it will implicitly cause
  // spooky-action-at-a-distance and modify the output entry object too. I've
  // chosen the shallow copy because it is generally faster and I assume I can
  // always be careful
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
