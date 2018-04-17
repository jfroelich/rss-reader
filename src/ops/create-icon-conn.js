import {FaviconService} from '/src/lib/favicon-service/favicon-service.js';

// Returns a promise that resolves to a database connection to the favicon
// database
export function create_icon_conn() {
  const service = new FaviconService();
  return service.open();
}
