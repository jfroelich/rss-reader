import {FaviconService} from '/src/lib/favicon-service.js';
import {create_icon_conn} from '/src/ops/create-icon-conn.js';

export async function clear_icons() {
  const fs = new FaviconService();
  const conn = await create_icon_conn();
  fs.conn = conn;
  await fs.clear();
  conn.close();
}
