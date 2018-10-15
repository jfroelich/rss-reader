import * as db from '/src/db/db.js';

export async function install_listener(event) {
  if (event.reason === 'install') {
    // We pass an explicit timeout of 0, meaning indefinite or no timeout,
    // because this is potentially a database upgrade that can take a long time
    // it will almost always timeout otherwise
    let name = undefined;
    let version = undefined;
    const timeout = 0;

    const session = await db.open(name, version, timeout);
    session.close();
  }
}
