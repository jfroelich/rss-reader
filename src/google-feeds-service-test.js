
function search(query) {
  const service = new GoogleFeedsService();
  service.verbose = true;
  service.search(query, function onSearch(event) {
    console.dir(event);
  });
}
