import * as db from '/src/db/db.js';

export async function install_listener(event) {
  if (event.reason === 'install') {
    const session = await db.open();
    session.close();
  }
}
