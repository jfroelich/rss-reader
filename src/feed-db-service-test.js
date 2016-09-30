
function test() {
  const service = new FeedDbService();
  service.name = 'test-feed-db-service';
  service.version = 1;
  service.verbose = true;
  service.open(openOnSuccess, openOnError);

  function openOnSuccess(event) {
    console.log('Successfully opened database', service.name);
    const conn = event.target.result;

    console.log('Requesting database %s to close eventually', service.name);
    conn.close();

    const deleteRequest = service.delete();
    deleteRequest.onsuccess = deleteOnSuccess;
    deleteRequest.onerror = deleteOnError;
  }

  function openOnError(event) {
    console.error(event.target.error);
    service.delete();
  }

  function deleteOnSuccess(event) {
    console.log('Successfully deleted database', service.name);
  }

  function deleteOnError(event) {
    console.error(event.target.error);
  }
}

window.addEventListener('DOMContentLoaded', test);
