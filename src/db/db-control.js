import * as db from './db.js';

// TODO: actually i am not sure this belongs there, the db module itself
// may not be concerned with when it is installed

export async function install_listener(event) {
  if (event.reason === 'install') {
    const session = await db.open();
    session.close();
  }
}
