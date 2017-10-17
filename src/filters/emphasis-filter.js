// html emphasis lib

/*
* For italicized or bolded text, check against a max character length, and if
text is too long, unwrap the italic/bold formatting. This will reduce the
number of times I see a full paragraph of italicized text which is difficult
to read, but still keep situations where just a small sentence or phrase is
emphasized. Maybe this should be a separate module "emphasis-filter".
*/

// TODO: consider the interactions with other filters that touch emphasis
// related tags, like the condense-names-filter. condense names should be
// run afterward. Or ... this should be designed to be associative so that
// filter call order does not affect logic and perhaps only performance.

function emphasis_filter(doc) {
  ASSERT(doc);

  // strong, b, em, i

  // not yet implemented
}
