import {entry_append_url, entry_create, entry_has_url} from '/src/rdb.js';

// Reformats a parsed feed entry as a storable entry
// @param parsed_entry {Object} an entry object such as that produced by
// feed_parse.
// @throws {Error} if parsed_entry is not an object
// @return {Object} a storable entry object
export function coerce_entry(parsed_entry) {
  // Create a storable entry with minimal properties. Because indexedDB cannot
  // store function objects, storable entries are basic objects with a hidden
  // type property. entry_create sets the hidden type property for us
  // automatically.
  const blank_storable_entry = entry_create();
  // Copy over all props from parsed entry to storable entry
  // TODO: should maybe be less trustworthy of properties coming from parse
  // format. Blindly copying over stuff might be bad. Kind of haphazard if
  // something like .magic is overwritten (implied in entry_create).
  const storable_entry = Object.assign(blank_storable_entry, parsed_entry);

  // Grab the link url {String} that was copied
  const link_url_string = storable_entry.link;
  // There is no 'link' property in the storable format. Delete it if it exists
  delete storable_entry.link;

  // Append the intial url of entry.urls. There is no guarantee that the link
  // url coming from the parsed entry was valid, so trap the parsing error, and
  // only append if valid. This also has the effect of verifying whether the url
  // is canonical
  // TODO: if parsing produced properties that are URL values instead of
  // strings, then I would not need to do this parsing here. Considering that
  // parsing already does some of that work, it seems silly to convert to url,
  // then to string, then to url again, and then back to string again. If
  // parsing produced values with URLs, then this would only do one url to
  // string conversion
  if (link_url_string) {
    try {
      entry_append_url(storable_entry, new URL(link_url_string));
    } catch (error) {
    }
  }

  return storable_entry;
}
