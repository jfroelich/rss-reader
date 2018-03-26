import {get_feeds} from '/src/operations/get-feeds.js';

// Returns an array of active feeds
export async function find_active_feeds(conn) {
  const feeds = await get_feeds(conn);
  return feeds.filter(feed => feed.active);
}
