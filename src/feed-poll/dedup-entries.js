import {rdb_entry_has_url} from '/src/rdb/rdb.js';

// Filter duplicate entries by comparing urls
export function dedup_entries(entries) {
  const distinct_entries = [];
  const seen_url_strings = [];

  for (const entry of entries) {
    // Retain entries without urls in the output without comparison
    if (!rdb_entry_has_url(entry)) {
      distinct_entries.push(entry);
      continue;
    }

    // Examine whether any of the current entry's urls have been seen before
    let url_is_seen = false;
    for (const url_string of entry.urls) {
      if (seen_url_strings.includes(url_string)) {
        url_is_seen = true;
        break;
      }
    }

    // If the entry had no seen urls, it is a distinct from the others already
    // seen, so append it
    if (!url_is_seen) {
      distinct_entries.push(entry);

      // And append all the new urls, we know that none have been seen
      seen_url_strings.push(...entry.urls);
    }
  }

  return distinct_entries;
}
