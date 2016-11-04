'use strict';

// Temp, testing promises

// Lesson: chrome only whines about uncaught if:
// Non-async function, use promise that throws without a .catch
// Async function: non-awaited promise that throws without catch

// So if using an async function, as long as I await something, it is
// implictly caught and the promise immediately rejects


function a() {
  return new Promise(function(resolve, reject) {
    throw new Error('test');
  });
}

// This works as expected, the uncaught exception thrown in a is thrown
// and the catch here catches it. MUST use await. If not awaited then it is
// not caught. Alternatively, must use a().catch(..).
async function b() {
  try {
    await a();
  } catch(error) {
    console.log('asynccatch', error);
  }
}

// I think the problem I have is if the constructor function itself is async?
// Recreate it here

function c() {
  return new Promise(async function(resolve, reject) {

    // If I do this, it works, I catch it here
/*
    try {
      await a();
    } catch(error) {
      console.log('c error', error);
    }
*/

    // Now try without try catch. Because we are inside a promise, this should
    // cause c to reject
    // This is the problem, it doesn't.
    //const f = await a();

    // What if I just throw an exception here
    // This also causes an uncaught exception.
    // Ok, this is the problem, I am trying to throw from inside an async
    // function, and it is leading to an uncaught exception. why.
    // My understanding from a and b is that throwing in a just rejects a so
    // long as it is later caught by .catch or by async try/catch
    //throw new Error('thrownfromc');

  });
}

async function d() {
  try {
    await c();
  } catch(error) {
    console.log('d error', error);
  }
}


// Misc. side note: an async function always returns a promise????
// Do I even need to return a promise?
// Ok try awaiting the return value of an async function

async function f() {
  return 'hello';
}



async function g() {
  try {
    const h = await f();
    console.log('h',h);
  } catch(error) {
    console.log('gerror', error);
  }
}

// Ok, wow, this does work. So I need to rewrite this all over the place.
// Once I do that I can come back to here and deal more with the error handling
// issue

// Side note, then test similar to fg, but have f just throw an error

// Actually, I need to find how what to do inside an async function if an error
// occurs, like, do I just throw it?

async function h() {
  iamnotdefinedinstrictmode = 4;
}

async function i() {
  try {
    const hresult = await h();
  } catch(error) {
    console.log('ierror', error);
  }
}

// It works! So the problem was that I was returning a promise using
// an async executor. Instead, just make the outer function async.

// Another thing to investigate:

/*
const proms = compacted_entries.map((entry) =>
  db_put_entry(tx, entry, log));
await Promise.all(proms);
*/
// I am not awaiting the individual promise calls, just the Promise.all.
// So what happens if one of the promise calls throws.
