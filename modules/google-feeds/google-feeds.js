// See license.md

'use strict';

// Provides a feed search service
class GoogleFeeds {

  // Sends a search request to Google, parses the response, and yields a two
  // property object consisting of query and entries. query is a formatted HTML
  // string. entries is an array. entries may be empty but is always defined.
  // entries contains search result basic objects with the properties url,
  // title, link, and contentSnippet.
  // Throws an exception if an error occurs when fetching the results.
  // @param query {String} a search string using Google search syntax
  // @param timeout {Number} a positive integer, optional
  static async search(query, timeout = 0) {
    this._assert_valid_query(query);
    const url = this._build_request_url(query);
    const options = this._build_request_options();

    // There is no built in way to cancel/timeout in the new fetch api.
    const promises = [fetch(url, options)];
    if(timeout)
      promises.push(this._fetch_timeout_promise(timeout));
    const response = await Promise.race(promises);
    this._assert_valid_response(response);
    const result = await response.json();
    const data = result.responseData;
    return {'query': data.query || '', 'entries': data.entries || []};
  }

  static _build_request_options() {
    const accept_header = 'application/json,text/javascript;q=0.9';
    return {
      'credentials': 'omit',
      'method': 'GET',
      'headers': {'Accept': accept_header},
      'mode': 'cors',
      'cache': 'default',
      'redirect': 'follow',
      'referrer': 'no-referrer'
    };
  }

  static _assert_valid_query(query) {
    if(typeof query !== 'string' || !query.trim().length)
      throw new TypeError('invalid query ' + query);
  }

  // TODO: use URL and URL.searchParams instead here?
  static _build_request_url(query) {
    const base = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
    return base + encodeURIComponent(query);
  }

  static _assert_valid_response(response) {
    if(!response.ok)
      throw new Error(`${response.status} ${response.statusText}`);
    if(response.status === 204) // No content
      throw new Error(`${response.status} ${response.statusText}`);
  }

  // TODO: just reject after x ms with an Error
  static _fetch_timeout_promise(timeout) {
    return new Promise((resolve) => setTimeout(resolve, timeout,
      new Response('', {'status': 524, 'statusText': 'Timed out'})));
  }
}
