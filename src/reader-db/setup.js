import open from "/src/reader-db/open.js";
import {close as closeDb} from "/src/indexeddb/utils.js";

// Create the reader-db database
export default async function main() {
  let conn;
  try {
    conn = await open();
  } finally {
    closeDb(conn);
  }
}
