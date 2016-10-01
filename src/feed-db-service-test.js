
function test() {
  const service = new FeedDbService();
  service.name = 'test-feed-db-service';
  service.version = 1;
  service.log.enabled = true;
  service.open(openOnSuccess, openOnError);

  function openOnSuccess(event) {
    console.log('Successfully opened database', service.name);
    const conn = event.target.result;
    console.log('Requesting database %s to close eventually', service.name);
    conn.close();
    const request = service.delete();
    request.onsuccess = deleteOnSuccess;
    request.onerror = deleteOnError;
  }

  function openOnError(event) {
    console.error(event.target.error);
    const request = service.delete();
    request.onsuccess = deleteOnSuccess;
    request.onerror = deleteOnError;
  }

  function deleteOnSuccess(event) {
    console.log('Deleted database', service.name);
  }

  function deleteOnError(event) {
    console.error(event.target.error);
  }
}

window.addEventListener('DOMContentLoaded', test);
