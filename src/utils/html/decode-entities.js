
// Given an input value, if it is a string, then creates and returns a new string where html
// entities have been decoded into corresponding values. For example, '&lt;' becomes '<'.

// Adapted from https://stackoverflow.com/questions/1912501

// TODO: i'd eventually like to not involve the dom but for now just get something working
// TODO: this could use cleanup and testing. The initial implementation was just to get something
// working for another module.

// NOTE: I believe the shared worker element technique is 'thread-safe' because all dom access
// is synchronous. Right? Pretty sure but never really verified.

const entityPattern = /&[#0-9A-Za-z]+;/g;
const workerElement = document.createElement('div');

export default function decodeEntities(value) {
  return typeof value === 'string' ? value.replace(entityPattern, replacer) : value;
}

function replacer(entityString) {

    // Set the value of the shared worker element. By using innerHTML this sets the raw value
    workerElement.innerHTML = entityString;

    // Now get the value back out. The accessor will do the decoding dynamically.
    // TODO: why innerText? probably should just use textContent? Wait until I implement a
    // testing lib to change.
    return workerElement.innerText;
}
