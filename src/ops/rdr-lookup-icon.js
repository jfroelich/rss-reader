import {FaviconService} from '/src/lib/favicon-service/favicon-service.js';

// conn, console, skip_fetch, url

export function rdr_lookup_icon(url, skip_fetch) {
  const fs = new FaviconService();
  fs.conn = this.conn;
  fs.console = this.console;
  fs.skip_fetch = skip_fetch;
  return fs.lookup(url);
}
