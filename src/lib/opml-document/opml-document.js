
export function find_feed_urls(document) {
  const elements = document.querySelectorAll('opml > body > outline');
  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;
  const urls = [];
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (type_pattern.test(type)) {
      const value = element.getAttribute('xmlUrl');
      if (value) {
        try {
          urls.push(new URL(value));
        } catch (error) {
        }
      }
    }
  }

  return urls;
}
