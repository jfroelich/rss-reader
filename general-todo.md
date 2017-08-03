
# Use explicit parameters instead of options object for functions

The language provides parameters, use them. Do not try and adopt a style less
intrinsic to the language.

# Maybe revert to IIFE syntax

The block scope syntax is strange. It requires global strict mode. Maybe
Move all 'use strict' out of global scope and into IIFE, similar to how
other libs do it. Or give up and switch to browserify and all that.

# C style

* Maybe try the c variable naming conventions again. I kind of like it.
* No need for brackets for single line if statements
* Uppercase const declared variables that are in global scope
* No anonymous functions for better stack traces
* Use Smalltalk-style hungarian notation because javascript is dynamically
typed which sometimes causes confusion


# const for..of

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of

Can use const instead of let e.g. (const var of iterator) ...
