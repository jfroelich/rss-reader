
// Testing issue with picking up a broadcast channel message sent from a tab
// to the same tab

// NOTE: so far my suspicion confirmed, I do not understand why I do not
// see event message in console.

console.debug('test loaded');

const bc = new BroadcastChannel('test-loopback');

bc.onmessage = function(event) {
  console.debug('event:', event);
};

console.debug('before post message call');
bc.postMessage('foo');
console.debug('after post message call');
