# About the rewrite-url module
This module is conceptually based on Apache's mod_rewrite module. The `rewrite_url` function changes a url based on a set of rewriting rules. A typical reason to use this is to reduce the number of urls in a list of urls where the first url redirects to each subsequent url. In other words, given a list of urls, reduce the list to a single url.

Here, redirect is defined loosely to account for atypical redirection methods. For example, a comment technique used by some websites is to pass outgoing link clicks through an intermediate page that tracks the clicks before continuing. The use of that intermediate page is something I do not like because of its network inefficiency and telemetry.

## TODO: do not hardcode rules
The rule set should be externally configurable and not require changes to the code
