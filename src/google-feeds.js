// See license.md

'use strict';

// Provides a way of searching for feeds to subscribe to using Google search
// Google formally deprecated this service in 2015 but apparently it is still
// working.
class GoogleFeeds {

  // Sends a search request to Google and yields a resulting object consisting
  // the properties 'query' and 'entries'. query is a formatted HTML
  // string. entries is an array. entries may be empty but is always defined.
  // entries contains search result basic objects with the properties url,
  // title, link, and contentSnippet, which are all strings.
  // @param query {String} a search string using Google search syntax
  // @param timeout {Number} a positive integer, optional
  static async search(query, timeout = 0) {
    this.assertValidQuery(query);
    const url = this.buildRequestURL(query);
    const options = this.buildRequestOptions();
    const response = await this.fetch(url, options, timeout);
    this.assertValidResponse(response);
    const result = await response.json();
    const data = result.responseData;
    return {'query': data.query || '', 'entries': data.entries || []};
  }

  static async fetch(url, options, timeout) {
    let response;
    if(timeout) {
      const promises = [];
      promises.push(fetch(url, options));
      promises.push(this.fetchTimeout(timeout));
      response = await Promise.race(promises);
    } else {
      response = await fetch(url, options);
    }
    return response;
  }

  static buildRequestOptions() {
    return {
      'credentials': 'omit',
      'method': 'GET',
      'headers': {'Accept': 'application/json,text/javascript;q=0.9'},
      'mode': 'cors',
      'cache': 'default',
      'redirect': 'follow',
      'referrer': 'no-referrer'
    };
  }

  static assertValidQuery(query) {
    if(typeof query !== 'string' || !query.trim().length)
      throw new TypeError('Invalid query ' + query);
  }

  static buildRequestURL(query) {
    const base = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
    return base + encodeURIComponent(query);
  }

  static assertValidResponse(response) {
    if(!response.ok)
      throw new Error(`${response.status} ${response.statusText}`);
    if(response.status === 204) // No content
      throw new Error(`${response.status} ${response.statusText}`);
  }

  static fetchTimeout(timeout) {
    return new Promise((resolve, reject) =>
      setTimeout(reject, timeout, new Error('Request timed out')));
  }
}
