// See license.md

'use strict';

async function test() {
  let db_target;
  let log = console;
  try {
    let num_deleted = await compact_favicons(db_target, log);
  } catch(error) {
    log.debug(error);
  }
}
