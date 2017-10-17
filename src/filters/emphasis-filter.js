

/*
* For italicized or bolded text, check against a max character length, and if
text is too long, unwrap the italic/bold formatting. This will reduce the
number of times I see a full paragraph of italicized text which is difficult
to read, but still keep situations where just a small sentence or phrase is
emphasized. Maybe this should be a separate module "emphasis-filter".
*/

function emphasis_filter(doc) {
  ASSERT(doc);

  // not yet implemented
}
