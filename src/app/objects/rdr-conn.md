
# Methods

* rdr_conn_create - opens a connection to the reader database
* rdr_conn_close - closes a connection to the reader database

# rdr_conn_create notes

* If the database does not exist, it will be created
* Optionally specify a timeout to limit how long to wait before considering the attempt to connect to the database a failure
* The name and version parameters are both optional. If not specified, then the call connects to the hardcoded default database. About the only reason to ever specify non-default values is for testing.

# rdr_conn_close notes

* Does nothing special outside of logging, so there is not much need for it, can always just use `conn.close`.
* Basically only exists as a way of attaching logging to the `conn.close` call, and to be consistent in resource APIs that provide disposition.
