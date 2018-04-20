The `create_conn` function opens a connection to the reader database.

### Notes

* If the database does not exist, it will be created
* Optionally specify a timeout to limit how long to wait before considering the attempt to connect to the database a failure
* The name and version parameters are both optional. If not specified, then the call connects to the hardcoded default database. About the only reason to ever specify non-default values is for testing.

### TODOs
* write doc
* tests
