import {rdr_create_channel} from '/src/operations/rdr-create-channel.js';

function test1() {
  console.debug('starting test1');
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

  const a = rdr_create_channel();
  a.onmessage = e => console.debug('a', e.data);

  const b = rdr_create_channel();
  b.onmessage = e => console.debug('b', e.data);

  a.postMessage({hello: 'from-a-to-everyone'});
  b.postMessage({hello: 'from-b-to-everyone'});

  setTimeout(_ => {
    console.debug('closing channels');
    a.close();
    b.close();
  }, 1000);

  console.debug('test1 complete but messages may be outstanding');
}

function test2() {
  // This fails, I never see the message get printed

  // See
  // https://html.spec.whatwg.org/multipage/web-messaging.html#dom-broadcastchannel-postmessage
  // Step 8. REMOVE SOURCE FROM DESTINATIONS

  // so I think this basically means a channel cannot send a message to itself


  console.debug('test2 start');
  const a = rdr_create_channel();
  a.onmessage = e => console.debug('a', e.data);
  a.postMessage({hello: 'world'});
  setTimeout(_ => {
    console.debug('closing channel');
    a.close();
  }, 3000);
  console.debug('test2 complete (still pending possible)');
}

window.test1 = test1;
window.test2 = test2;
