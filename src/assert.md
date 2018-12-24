# assert
Provides a basic `assert` function and a typed error indicating an assertion failure.

## Assertions are just syntactic sugar
It is tempting to thing of assertions as some gigantic complicated module that involves lots of magical strange stuff under the hood. I disagree. A better way to perceive this module's funtionality, to understand what it does, is to look at the code written in its absence:

```JavaScript
function foo() {
  if(!someCondition) {
    throw new Error('The condition was false!');
  }
  // ...
}
```

An assertion is nothing more than a shortcut way to write the exact same thing as above using less code, but a little more overhead:

```JavaScript
function foo() {
  assert(someCondition, 'The condition was false!');
  // ...
}
```

## Use care when calling functions that assert
Typically an assertion error in other programming languages rises to the level of a `panic`. However, Javascript has no `panic` equivalent that halts all processing and exits the program. I've seen some approximations of panic but they are just too ugly for my taste.

An assertion error in this module's definition is just another kind of error (an exception). Therefore, every function that calls another function has to be careful when that other function may throw assertion errors. If the calling context uses a try/catch, it is very easy to accidentally hide assertion errors.

## Use assertions conservatively
When getting started with assertions, it is really tempting to just assert everything you possibly can. This is dumb.

First, Javascript has no compile-time-only expressions like in C and C++. Everything happens at runtime. Assertions impose a performance penalty. You want to avoid bad performance. If something is in a nested loop, consider explicitly hoisting (moving) the assertion into the caller context and removing it from the called function, and instead relying on the function's documentation to warn about the issue. Or, while it is much harder to do, try and design functions and modules in such a way that you do not need to make performance sensitive assertions, because the design of the API itself makes it impossible to even get things into an impossible or bad state. That is a really hard thing to do, so unless you are a genius, I would use documentation.

Second, there are many things that a function could assert about its pre-conditions. However, the general rule is that a function should only make assertions about the things it deals with directly, itself, and not about unrelated things in other areas of the program. Calling the function `add(1,2)` should not somehow trigger an assertion error about an earthquake in a different country.

Third, an assertion should typically be used only against a value or a simple expression. I recommend against doing something like `assert(expensiveFunctionCall());`. Especially when that expensive function call is tangential to the function's stated purpose.

## Use care when relying on implicit Boolean coercion
The assert function's first parameter is a Boolean parameter. However, you can pass in any value or expression to the function. Javascript will implicitly coerce the value to true or false.

That's fine. However, as a matter of convention and preference, I would prefer to always use a Boolean parameter. This reduces any mistaken interpretation of how implicit coercion to Boolean works. There are some real gotchas in Javascript. If you are bothering to be careful enough to use assertions, then this kind of extra concern is merited/warranted/worth it.

## Only assert against invariant conditions
An invariant is just a fancy word for something that is constant for the lifetime of the program.

You typically only want to use assertions when verifying the state of a program and checking that something is always true, 100% of the time, constantly, never changing. For example, if a function expects a variable to always be in a certain state at the start of the function, this would be a good thing to assert.

You do not want to use an assertion to test against something that is variant (that varies, that is not invariant, that is not constant). For example, when making an HTTP request, you are communicating with a system outside of the program's control. Perhaps that system is unavailable at the time of the communication. Perhaps it is temporarily unavailable. Things that come and go and change state unpredictably and unreliably do not represent invariant conditions. Therefore, for example, you should not be asserting that a fetch was successful.

## Do not assert naturally occurring errors
There are certain naturally occurring errors in Javascript. For example, using an undeclared variable in an expression causes an error.

While it is possible to preemptively avoid such situations by using some careful sanity-check-style assertions preceding various expressions, I would advise against doing this, as a matter of convention. There is already a built in error that will occur. You are essentially just duplicating built in behavior with explicit coder-defined behavior, and in doing so, risking that your copy of the behavior differs. It is preferable to rely on built in behavior where it is consistent. It is preferable to rely on built in behavior where using an assertion just adds more boilerplate. It is preferable not to assert when there is a risk the assert just delays or masks the occurrence of some later error that is going to happen anyway.

Basically, if there is going to be an error that is going to occur, let that error occur. Don't jump in front of it with an assertion. The error case is basically already handled. An assertion does not really add much value, except perhaps to make some concern more explicit.

For example:

```JavaScript
function concat(array1, array2) {
  return array1.concat(array2);
}
```

In this example, when array1 is undefined, an error will naturally occur. Therefore, the following kind of assertion should not exist:

```JavaScript
function concat(array1, array2) {
  assert(Array.isArray(array1), 'array1 is not an array!');
  return array1.concat(array2);
}
```

The interpreter already captures this error. Allow the interpreter to raise the error implicitly.
