import {FaviconService} from '/src/lib/favicon-service/favicon-service.js';

export function lookup_icon(url, document, fetch = true) {
  const fs = new FaviconService();
  fs.conn = this.conn;
  fs.console = this.console;
  fs.skip_fetch = !fetch;
  return fs.lookup(url, document);
}
