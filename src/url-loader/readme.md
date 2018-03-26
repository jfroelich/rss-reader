# Overview
Provides functionality for loading a resource via its URL. This module exists primarily because:

* The native `fetch` function cannot timeout
* The native `response.redirected` property is weird
* Stricter mime type checking that `Accept` header (which seems to be ignored)

The response type specialized helpers do not deserialize. This is because of the occasional need for the caller to have an interceding test of whether to proceed with handling a response, from between the time the response headers are known and before the body is loaded.

### todos

* separate out policy module somehow
* move to lib folder once I separate out policy
* abort-able/cancelable fetching
