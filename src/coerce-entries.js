import {entry_append_url, entry_create, entry_has_url} from '/src/rdb.js';


// TODO: to be more consistent with coerce_feed, consider that it may be better
// to make the caller be concerned with iteration over the array, and instead
// this just exports coerce_entry function that takes an entry object. I think
// that would be better. It is more flexible. On the other hand it creates more
// caller boilerplate. But not that much. Actually I think I should do this.


// TODO: should maybe be less trustworthy of properties coming from parse
// format. Blindly copying over stuff might be bad. Kind of haphazard if
// something like .magic is overwritten (implied in entry_create).

// Given an array of parsed entries, this converts each parsed entry into a
// storable entry and then returns an array of storable entries.
// @param parsed_entries {Array} an array of entries in the parsed format
// @throws TypeError if input is not an array
// @returns {Array} an an array of entries in the storage format
export function coerce_entries(parsed_entries) {
  if (!Array.isArray(parsed_entries)) {
    throw new TypeError('Invalid parsed_entries argument ' + parsed_entries);
  }

  const storable_entries = [];
  for (const entry of parsed_entries) {
    const blank_storable_entry = entry_create();
    // Copy over all props
    const storable_entry = Object.assign(blank_storable_entry, entry);

    // Convert entry.link into the first entry url
    if ('link' in storable_entry) {
      try {
        const url = new URL(storable_entry.link);
        entry_append_url(storable_entry, url);
      } catch (error) {
        console.debug(
            'Failed to coerce entry link to url', storable_entry.link);
      }

      // There is no 'link' property in the storable format
      delete storable_entry.link;
    }
    storable_entries.push(storable_entry);
  }

  return storable_entries;
}
