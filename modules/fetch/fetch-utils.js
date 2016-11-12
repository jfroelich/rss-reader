// See license.md

'use strict';

// Resolves after the specified number of ms has elapsed.
// Browsers set a lower bound on timeouts. Generally, even if a timeout is less
// than about 15ms, it implicitly waits.
// See http://www.adequatelygood.com/Minimum-Timer-Intervals-in-JavaScript.html
// setTimeout appears to treat an invalid timeout parameter as equivalent to 0,
// but this considers an invalid parameter an error.
// TODO: is throwing immediately better than eventually rejecting?
// @param timeout_ms {Number} an integer >= 0
// @param value {any} the value to resolve with
function set_timeout_promise(timeout_ms, value) {
  return new Promise(function(resolve, reject) {
    if(!Number.isInteger(timeout_ms) || timeout_ms < 0)
      return reject(new TypeError(`Invalid timeout parameter ${timeout_ms}`));
    setTimeout(resolve, timeout_ms, value);
  });
}

// TODO: i don't love how this is a dependency everywhere when it is so
// simple. Inline this everywhere to reduce coupling

// TODO: i think it would be much simpler to just reject with a Timed out error
// after x ms. No need to create a response. When used with Promise.race, the
// rejection can still win.

// Resolves with a fake 524 timed out response after timeout_ms milliseconds.
// 524 is a non-standard Cloudflare code that seems to be the most appropriate.
async function fetch_timeout(timeout_ms) {
  const body = '';
  const init = {'status': 524, 'statusText': 'A Timeout Occurred'};
  const response = new Response(body, init);
  return await set_timeout_promise(timeout_ms, response);
}
