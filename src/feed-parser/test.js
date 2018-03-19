import * as feed_parser from '/src/feed-parser/feed-parser.js';
import * as url_loader from '/src/url-loader/url-loader.js';

window.test = async function(url_string) {
  const request_url = new URL(url_string);
  const response = await url_loader.fetch_feed(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const text = await response.text();
  const skip_entries = false;
  const resolve_urls = true;
  const parsed_feed = feed_parser.parse(text, skip_entries, resolve_urls);
  console.dir(parsed_feed);
};
