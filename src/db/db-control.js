import * as db from './db.js';

// TODO: actually i am not sure this belongs there, the db module itself
// may not be concerned with when it is installed

export async function install_listener(event) {
  if (event.reason === 'install') {
    let name = undefined;
    let version = undefined;

    // We pass an explicit timeout of 0, meaning indefinite or no timeout,
    // because this is potentially a database upgrade that can take a long time
    const timeout = 0;

    const session = await db.open(name, version, timeout);
    session.close();
  }
}
