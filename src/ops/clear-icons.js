import {FaviconService} from '/src/lib/favicon-service.js';
import {create_icon_conn} from '/src/ops/create-icon-conn.js';

// TODO: Create an ops/icons.js module, merge all icon related operations into
// it. I think this will make it easier to change things if icon functionality
// changes, and will reduce the number of operations modules.

export async function clear_icons() {
  const fs = new FaviconService();
  const conn = await create_icon_conn();
  fs.conn = conn;
  await fs.clear();
  conn.close();
}
