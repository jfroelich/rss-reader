// See license.md

// TODO: test timeouts

async function test_db() {
  console.log('Starting db test');
  const name = 'test-feed-db';
  const version = 1;
  let timeout_ms;
  let is_conn_closed = false;
  let conn;
  try {
    console.log('Connecting to database', name);
    conn = await reader_db.open(name, version, timeout_ms);
    console.log('Closing connection to', name);
    conn.close();
    is_conn_closed = true;
    console.log('Deleting database', name);
    await test_delete_db(name);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn && !is_conn_closed)
      conn.close();
  }

  console.log('Db Test completed');
}

function test_delete_db(name) {
  function resolver(resolve, reject) {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}
