# url-loader
Provides functionality for loading a resource via its URL. This module exists primarily because:
* The native `fetch` function cannot timeout
* The native `response.redirected` property is weird
* Stricter mime type checking of `Accept` header (which seems to be ignored)

### todos
* abort-able/cancelable fetching
