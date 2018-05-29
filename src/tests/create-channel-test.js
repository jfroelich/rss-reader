import * as config from '/src/config.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: these functions need to be rewritten to not complete until actually
// complete. that means that forked outstanding microtasks need to be awaited.
// In the test content we are not trying to return early. If anything returning
// early in this context is misleading. It is also misleading if this test is
// somehow used as a benchmark.
// TODO: these tests should be named after what they test, should not be using
// generic names
// TODO: a test should generally test only one thing (a unit), the exception to
// this rule is when there is so much that goes into setup and teardown that it
// is just easier to reuse the setup and tear down, i may need to create more
// tests
// TODO: these tests should only be testing the purpose of create-channel, not
// other aspects of channels, that kind of testing belongs elsewhere, perhaps
// back in experimental and not here
// TODO: these should not be using the app's real channel, that risks sending
// real messages to the live app and causing unintended consequences. So these
// should instead be using a mock channel name. This should be completely
// decoupled from channel_name constant.
// TODO: there is one test however that should use the app's actual channel,
// and it is simply a test that verifies the config value is correct, that
// channel_name is a defined string. And maybe later I will think this test is
// dumb

// TODO: this test relates to general js functionality, not to app
// functionality. It should probably just exist somewhere else, or not at all.
async function create_channel_test1() {
  console.debug('%s: starting...', create_channel_test1.name);

  // NOTE: the key thing to understand is that channel instances do not
  // loopback. An instance cannot hear its own messages. A BroadcastChannel
  // instance is not identical to a channel. When two or more instances share
  // the same channel, each instance can hear the other, but each instance
  // cannot hear itself (an instance does not receive its own messages). It
  // would be interesting to learn more about why the designers chose to prevent
  // a channel from hearing itself.

  // See step #8 in the spec.
  // https://html.spec.whatwg.org/multipage/web-messaging.html#dom-broadcastchannel-postmessage

  // By preference, name the shared channel after the function. It helps avoid
  // the chance this ever actually communicates with the app. At the moment that
  // would not be catastrophic but it should be avoided because of the general
  // rule that test runs should not impact app state.
  const channel_name = create_channel_test1.name;

  const a = new BroadcastChannel(channel_name);
  a.onmessage = e => console.debug('a', e.data);

  const b = new BroadcastChannel(channel_name);
  b.onmessage = e => console.debug('b', e.data);

  a.postMessage({hello: 'from-a-to-everyone'});
  b.postMessage({hello: 'from-b-to-everyone'});

  // TODO: wait here for both a and b to receive their messages
  // TODO: to verify the above understanding of how channels work, there should
  // be at least two assertions here. I should assert that a received b, and
  // that b received a. I should probably do this by awaiting promises. Once
  // I setup both awaits, revisit and probably use Promise.all with only 1
  // await.

  const close_timeout = 10;
  await defer(function() {
    console.debug('%s: closing channels', create_channel_test1.name);
    a.close();
    b.close();
  }, close_timeout);

  console.debug('%s: complete', create_channel_test1.name);
}

// Run the function after waiting for the given amount of time, and then resolve
function defer(deferred_sync_function, timeout_ms) {
  return new Promise(resolve => {
    setTimeout(_ => {
      deferred_sync_function();
      resolve();
    }, timeout_ms);
  });
}

async function create_channel_test2() {
  // NOTE: this was a test to learn about channel behavior. It was code written
  // for the purpose of learning, not testing. It just sits as a test now, but
  // it does not actually do anything. Should probably delete.

  // This fails, I never see the message get printed

  // so I think this basically means a channel cannot send a message to itself

  console.debug('test2 start');
  const a = new BroadcastChannel(create_channel_test2.name);
  a.onmessage = e => console.debug('a', e.data);
  a.postMessage({hello: 'world'});

  // TODO: this is wrong, should not close channels async, the test should
  // actually wait for the operation to complete and not return while forked
  // code is running. See what I did in the other test

  setTimeout(_ => {
    console.debug('closing channel async');
    a.close();
  }, 20);

  console.debug('create_channel_test2 complete (still pending possible)');
}

register_test(create_channel_test1);
register_test(create_channel_test2);
