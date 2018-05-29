import * as config from '/src/config.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: these functions need to be rewritten to not complete until actually
// complete
// TODO: these tests should be named after what they test
// TODO: a test should test only one thing (a unit)
// TODO: these tests should only be testing the purpose of create-channel, not
// other aspects of channels, that kind of testing belongs elsewhere, perhaps
// back in experimental and not here

// TODO: these should not be using the app's real channel, that risks sending
// real messages to the live app and causing unintended consequences. So these
// should instead be using a mock channel name. This should be completely
// decoupled from channel_name constant. Perhaps it should do a really simple
// test that verifies the config is correct (channel_name is a defined string)

async function create_channel_test1() {
  console.debug('%s: starting...', create_channel_test1.name);
  // When two channgels exist, both should get the same message
  // Part two of this test, is sending a message to a channel on the same page.
  // Ok, same page works, but not the first part

  // Ok, if close is called too quickly, then message is not sent, either that,
  // or it is sent, and received, but ignored and not reported to onmessage
  // Well, if it is not sent because closed too quickly, that is one possible
  // explanation.

  // Ok now here is the weird thing. I should see 4 messages. Both receiving it
  // twice. But I am not. I am seeing b receive a and a receive b

  // or maybe since both listen to the same channel, only one reports, because
  // that depletes the queue?
  // no, because I see this in the log:
  // b {hello: "from-a-to-everyone"}
  // a {hello: "from-b-to-everyone"}

  // ok one thing to do would be to create one and see if it gets its own
  // message

  const a = new BroadcastChannel(config.channel.name);
  a.onmessage = e => console.debug('a', e.data);

  const b = new BroadcastChannel(config.channel.name);
  b.onmessage = e => console.debug('b', e.data);

  a.postMessage({hello: 'from-a-to-everyone'});
  b.postMessage({hello: 'from-b-to-everyone'});

  setTimeout(_ => {
    console.debug('closing channels async');
    a.close();
    b.close();
  }, 20);

  console.debug(
      'create_channel_test1 complete but messages may be outstanding');
}

async function create_channel_test2() {
  // This fails, I never see the message get printed

  // See
  // https://html.spec.whatwg.org/multipage/web-messaging.html#dom-broadcastchannel-postmessage
  // Step 8. REMOVE SOURCE FROM DESTINATIONS

  // so I think this basically means a channel cannot send a message to itself

  // TODO: this is wrong, should not close channels async, the test should
  // actually wait for the operation to complete and not return while forked
  // code is running

  console.debug('test2 start');
  const a = new BroadcastChannel(config.channel.name);
  a.onmessage = e => console.debug('a', e.data);
  a.postMessage({hello: 'world'});
  setTimeout(_ => {
    console.debug('closing channel async');
    a.close();
  }, 20);
  console.debug('create_channel_test2 complete (still pending possible)');
}

register_test(create_channel_test1);
register_test(create_channel_test2);
