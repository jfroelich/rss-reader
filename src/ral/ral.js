import {rdr_create_conn} from '/src/operations/rdr-create-conn.js';
import {rdr_create_icon_conn} from '/src/operations/rdr-create-icon-conn.js';
import {rdr_import} from '/src/operations/rdr-import-opml.js';

export async function import_opml(channel, files) {
  const ctx = {};
  ctx.fetch_timeout = 10 * 100;
  ctx.channel = channel;
  ctx.console = console;

  const open_promises = [rdr_create_conn(), rdr_create_icon_conn()];
  [ctx.rconn, ctx.iconn] = await Promise.all(open_promises);
  await rdr_import(ctx, files);
  ctx.rconn.close();
  ctx.iconn.close();
}
