# cache.js
This module provides persistence for favicon.js. This should be considered private to favicon.js and its test module. Do not directly import. favicon.js re-exports any of the functions that are needed.

## todos
* test that creating a second entry in cache with same url does not create second and just overwrites first
