import open as openDb from "/src/reader-db/open.js";
import {close as closeDb} from "/src/utils/indexeddb-utils.js";

// Create the reader-db database
export default async function main() {
  let conn;
  try {
    conn = await openDb();
  } finally {
    closeDb(conn);
  }
}
