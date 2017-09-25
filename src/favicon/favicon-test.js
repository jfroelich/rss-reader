'use strict';

async function test_favicon_lookup(url_string, is_cacheless) {
  const url_object = new URL(url_string);
  let conn, db_name, db_version;
  let max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size, db_connect_timeout_ms;
  const verbose = true;

  try {
    if(!is_cacheless)
      conn = await favicon_open_db(db_name, db_version, db_connect_timeout_ms,
        verbose);
    const icon_url_string = await favicon_lookup(conn, url_object, max_age_ms,
      fetch_html_timeout_ms, fetch_img_timeout_ms, min_img_size,
      max_img_size, verbose);
    console.log('favicon_lookup output:', icon_url_string);
  } finally {
    if(conn)
      conn.close();
  }
}

async function test_clear_icon_db() {
  const verbose = true;
  let conn, db_name, db_version, conn_timeout_ms;
  try {
    conn = await favicon_open_db(db_name, db_version, conn_timeout_ms, verbose);
    await favicon_clear_db(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn)
      conn.close();
  }
}

async function test_compact_icon_db() {
  const verbose = true;
  let db_name, db_version, max_age_ms;
  const num_entries_deleted = await favicon_compact_db(db_name, db_version,
    max_age_ms, verbose);
  console.log('Deleted %d entries', num_entries_deleted);
}
