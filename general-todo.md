
# Use explicit parameters instead of options object for functions

The language provides parameters, use them. Do not try and adopt a style less
intrinsic to the language.

# Maybe revert to IIFE syntax

The block scope syntax is strange. It requires global strict mode. Maybe
Move all 'use strict' out of global scope and into IIFE, similar to how
other libs do it.

Or ... give up and switch to browserify and all that.
