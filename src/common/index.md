
# About

The common folder contains a set of modules that are used by multiple services. Generally each service only works with its own internal modules. The common folder is the exception to this rule.

Temporary note: I've outlined this in some issue but what I plan to do is move several utilities
that are shared by multiple services into this folder, and refactor them. Some utilities will go away or change. Because modules here are not just utilities in the sense that they are helpful functions but rather because these are shared (versus not shared). Right now the criteria for something being in the utils folder is not because it is shared or not shared, but just because it is helpful, and utils was a cop-out thoughtless method of organization.
