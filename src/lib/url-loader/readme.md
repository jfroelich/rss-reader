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

One idea for separating out policy would be the following. First create separate operations for the specialized helpers like fetch_html and fetch_feed in the operations folder. Then remove them from the url-loader module. Next, do the policy-check pre-fetch in the operations. Next, remove the policy-check from the url-loader module. One caveat so far that I foresee is that I think there are unfortunately some dependencies that depend directly on the main timed-fetch function. Maybe splitting up the helpers is not a good idea. The helpers depend upon error constants so the caller would also have to import those from the lib, unless I re-exported them all again from the helpers.
