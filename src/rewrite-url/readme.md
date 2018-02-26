# About the rewrite-url module

This module is conceptually based on Apache's mod_rewrite module.

The url_rewrite function changes a url based on a set of rewriting rules. A typical reason to use this is to reduce the number of urls in a list of urls where the first url redirects to each subsequent url. In other words, given a list of urls, reduce the list to a single url.

Here, redirect is defined loosely to account for atypical redirection methods. For example, a comment technique used by some websites is to pass outgoing link clicks through an intermediate page that tracks the clicks before continuing.

The use of that intermediate page is something I do not like, for a variety of reasons:

- Inefficiencies, such as excessive network requests, that do consider performance ramifications such as metered connections, application speed
- Short-circuits the follow redirects configuration when loading url contents, rendering pages blank
- Telemetry that is borderline invasive and  lacks consent (debatable)

## TODO: naming consistency

the folder and file name are rewrite-url, but the function name is url_rewrite. keep the noun-verb order consistent. pick one.

## TODO: do not hardcode rules

The rule set should be externally configurable and not require changes to the code

## TODO: cyclical (recursive) rule evaluation

The output of each rule that changes the url should be reconsidered by all rules in a loop until no changes are applied
