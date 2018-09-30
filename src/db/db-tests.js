// Collect all the various tests in the db module into a single module so that
// the tests can be easily added in one go to a testing client.


export {activate_feed_test} from '/src/db/activate-feed-test.js';
export {archive_entries_test} from '/src/db/archive-entries-test.js';
export {count_unread_entries_test} from '/src/db/count-unread-entries-test.js';
export {create_entry_test} from '/src/db/create-entry-test.js';
export * from '/src/db/create-feed-test.js';
export {create_feeds_test} from '/src/db/create-feeds-test.js';
export {deactivate_feed_test} from '/src/db/deactivate-feed-test.js';
export {delete_entry_test} from '/src/db/delete-entry-test.js';
export {delete_feed_test} from '/src/db/delete-feed-test.js';
export * from '/src/db/entry-utils-test.js';
export * from '/src/db/feed-utils-test.js';
export {filter_unprintables_test} from '/src/db/filter-unprintables-test.js';
export {get_entries_test} from '/src/db/get-entries-test.js';
export {get_entry_test} from '/src/db/get-entry-test.js';
export {get_feed_test} from '/src/db/get-feed-test.js';
export {get_feeds_test} from '/src/db/get-feeds-test.js';
export {iterate_entries_test} from '/src/db/iterate-entries-test.js';
export {mark_entry_read_test} from '/src/db/mark-entry-read-test.js';
export {remove_lost_entries_test} from '/src/db/remove-lost-entries-test.js';
export {remove_orphaned_entries_test} from '/src/db/remove-orphaned-entries-test.js';
export {replace_tags_test} from '/src/db/replace-tags-test.js';
export * from '/src/db/sanity-test.js';
export {update_entry_test} from '/src/db/update-entry-test.js';
export {update_feed_test} from '/src/db/update-feed-test.js';
