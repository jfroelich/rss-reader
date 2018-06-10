import {mark_entry_read} from '/src/db.js';

export async function mark_slide_read(conn, slide) {
  console.assert(conn instanceof IDBDatabase);
  console.assert(slide);

  if (slide.hasAttribute('read') || slide.hasAttribute('stale')) {
    const entry_id_string = slide.getAttribute('entry');
    console.debug('Ignoring stale/read slide', entry_id_string);
    return;
  }

  const id = parseInt(slide.getAttribute('entry'), 10);
  const channel = new BroadcastChannel(localStorage.channel_name);
  await mark_entry_read(conn, channel, id);
  channel.close();
}
