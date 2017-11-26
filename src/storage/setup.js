import {close, open} from "/src/storage/rdb.js";

// Create the reader-db database
export default async function setup() {
  let conn;
  try {
    conn = await open();
  } finally {
    close(conn);
  }
}
