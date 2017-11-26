import {open} from "/src/storage/rdb.js";
import {close as closeDb} from "/src/utils/indexeddb-utils.js";

// Create the reader-db database
export default async function setup() {
  let conn;
  try {
    conn = await open();
  } finally {
    closeDb(conn);
  }
}
