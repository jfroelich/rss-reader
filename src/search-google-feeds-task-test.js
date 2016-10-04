
function search(query) {
  const task = new SearchGoogleFeedsTask();
  task.log.enabled = true;
  task.start(query, function onSearch(event) {
    console.dir(event);
  });
}
