// Toying with the idea of passing around a global function to log things,
// similar to a macro-ish function in c/c++, instead of the full console. I
// have noticed I really don't care about the various logging methods, just a
// general logging function.

// However, the problem with this is that it obscures the source of the call
// when the message appears in the console, which is the file name and the line
// number. So I am not quite sure whether to go ahead.

// It will make stubbing even easier, just point to a noop.

// Note I am trying to avoid a fully lazy logging mechanism. I don't want a
// function with a boolean inside it. I would rather have two functions, one of
// which is a noop, and change which function the exported identifier
// references. This way when logging is off it is just a call to a noop.

// Another thing I am thinking about, is how to control logging. Right now I am
// taking the approach of passing around a console object to every important
// function. Every function has this extra parameter. It would go along way
// toward simplicity and readability if I reduced the number of parameters.

// There are pros/cons. E.g. now there is just this global switch, and a flood
// of things start spewing, instead of restricting messages to a particular
// function call, or a path of calls.

// At this point I really have not made up my mind. Although one thing that
// would at least go halfway, is that I can keep the parameter, but get at least
// change it from a console object into just a logging function, given the
// realization that I do not need the flexibility of the object. So I think that
// is the first step, to change all the console params into 'log' methods, and
// just pass around the log function. I could deprecate console-stub too.

export const log = {
  debug: noop
};

export function enable_logging() {
  log.debug = log_debug;
}

export function disable_logging() {
  log.debug = noop;
}

function log_debug(...args) {
  console.log(...args);
}

function noop() {}
