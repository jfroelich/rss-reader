import {db_open} from '/src/db/db-open.js';
import {favicon_create_conn} from '/src/favicon.js';
import {import_opml} from '/src/import-opml.js';
import {log} from '/src/log.js';

// TODO: think of a shorter name
// TODO: think of a more generic name, like import-component-onclick

// TODO: the view should not interact directly with db


export function import_menu_option_onclick(event) {
  const uploader_input = document.createElement('input');
  uploader_input.setAttribute('type', 'file');
  uploader_input.setAttribute('accept', 'text/xml');
  uploader_input.onchange = uploader_input_onchange;
  uploader_input.click();
}

// Fired when user submits file browser dialog
//
// Uses a function-call lifetime channel instead of the page-lifetime channel to
// avoid the no-loopback issue.
//
// TODO: show operation started immediately, before doing any time-consuming
// work
// TODO: after import, visually inform the user that the operation completed
// successfully
// TODO: after import, refresh feed list so that it displays any new feeds, if
// feed list is visible
// TODO: after import, switch to feed list section or at least show a message
// about how the import completed successfully, and perhaps other details such
// as the number of subscriptions added
// TODO: on import error, show a friendly error message
async function uploader_input_onchange(event) {
  log('%s: started', uploader_input_onchange.name);
  const op = {};
  [op.rconn, op.iconn] = await Promise.all([db_open(), favicon_create_conn()]);
  op.channel = new BroadcastChannel(localStorage.channel_name);
  op.fetch_timeout = 5 * 1000;
  op.import_opml = import_opml;
  await op.import_opml(event.target.files);
  op.rconn.close();
  op.iconn.close();
  op.channel.close();
  log('%s: completed', uploader_input_onchange.name);
}
