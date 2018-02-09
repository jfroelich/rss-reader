import {entry_append_url, entry_create, entry_has_url} from '/src/rdb.js';

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

  // Grab the link url that was copied
  const link_url_string = storable_entry.link;
  // There is no 'link' property in the storable format
  delete storable_entry.link;

  // Append the intial url of entry.urls
  if (link_url_string) {
    try {
      entry_append_url(storable_entry, new URL(link_url_string));
    } catch (error) {
    }
  }

  return storable_entry;
}
