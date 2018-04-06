import {FaviconService} from '/src/lib/favicon-service/favicon-service.js';

export function rdr_lookup_icon(conn, console, skip_fetch, url) {
  const fs = new FaviconService();
  fs.conn = conn;
  fs.console = console;
  fs.skip_fetch = skip_fetch;

  return fs.lookup(url);
}
