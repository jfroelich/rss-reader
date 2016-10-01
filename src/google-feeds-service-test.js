
function search(query) {
  const service = new GoogleFeedsService();
  service.log.enabled = true;
  service.search(query, function onSearch(event) {
    console.dir(event);
  });
}
