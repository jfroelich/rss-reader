# Overview
The `filter_publisher` function provides a way to strip publisher information from an article title. The input title variable is a `DOMString` and an optional options object. The function returns a new string where the publisher information has been stripped.

The function basically works by looking for typical delimiters found in document titles, such as the dash character found in &quot;Florida man shoots self - Your Florida News&quot;.

If there is any problem, then the original title is returned. For example, the function received bad input. Or the function was not confident about whether it found a publisher substring and decided not to remove it.

## Options

* **max_tail_words** - the maximum number of words following delimiter, if the number of words following the delimiter is greater than this number then the publisher is considered too long and therefore unlikely a publisher and therefore is not filtered
* **min_title_length** - the minimum number of characters in a title, if the title is too short before or after filtering the publisher then the publisher is not filtered
* **min_publisher_length** - minimum number of characters in publisher name, including spaces, if the publisher is too short then the publisher is not filtered
* **delims** - array of strings, delimiters (currently including spaces between the delimiter and other words)

If any option is not set, a default value is used. Options are not validated

## Other notes

* This is intended to be a standalone JavaScript module with no dependencies. The idea is modeled after a micro-service architecture. This extreme decoupling makes it easy to change so long as the API's warranties are continually supported.
* This uses a typical optional options object instead of several parameters, along with some defaults. This is intentional. It is a typical pattern. It is used in other programs and used throughout this set of modules.

## Todos

* input is a DOM string, think more about entities
* do not require delims to have spaces, make it less wonky
