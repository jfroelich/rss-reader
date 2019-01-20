# assert
Provides a basic `assert` function and a typed error indicating an assertion failure.

## Recognize that assertions are just syntactic sugar
* An assert is a really simple if condition that throws an error
* Do not make it more convoluted than that
* It helps make code more idiomatic and terse/concise

## Use care when calling functions that assert
* JavaScript has no `panic(msg)` equivalent
* I define asserts as basic exceptions of a certain type `AssertionError`
* Therefore exception handling has to watch out for assertion errors. Assertion errors should be distinguished from other errors. A catch block should be aware it is always handling its expected errors, plus any possible assertion errors, and take care not to suppress the assertion error.

## Use assertions conservatively
* Do not assert everything under the sun
* Assertions induce runtime overhead because javascript is interpreted
* Design functions that alleviate the need to assert, e.g. make the API of a function nigh impossible to use incorrectly
* Assertions should be local and relevant to their context, don't assert the state of something else in a different module, that is that other module's concern, the module should go the distance to remove the need for the caller to have any anxiety about correctness
* Avoid expensive runtime assertions at the cost of correctness

## Use care when relying on implicit Boolean coercion
The assert function's first parameter is a Boolean parameter. However, you can pass in any value or expression to the function. Javascript will implicitly coerce the value to true or false. Prefer boolean as a matter of convention, or when coercion is obvious.

## Only assert against invariant conditions
An invariant is just a fancy word for something that is constant for the lifetime of the program (in the case of a database program, that is indefinite). Assert against constant pre and post conditions (entrance and exit states of variables in functions). HTTP response errors are variant (e.g. ephemeral, temporary). Most database errors are invariant, the database should never fail or something is really wrong and not much point in doing anything.

## Do not assert naturally occurring errors
There are certain naturally occurring errors in Javascript. For example, using an undeclared variable in an expression causes an error. Do not assert as a matter of convention.
