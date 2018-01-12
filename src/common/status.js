
// TODO: eventually clean this up

export const OK = 0;
export const EFETCH = 1;
export const ENET = 2;
export const ENOACCEPT = 3;
export const EOFFLINE = 4;
export const EPARSEXML = 5;
export const EPARSEFEED = 6;
export const EPARSEHTML = 7;
export const EPARSEOPML = 8;
export const EPOLICY = 9;
export const ETIMEOUT = 10;
export const EDBCONSTRAINT = 11;
export const EDBOPEN = 12;
export const EINVALIDSTATE = 13;
export const EINVAL = 14;
export const EDB = 15;
export const EFAVICON = 16;

export function toString(status) {
  switch(status) {
  case OK: return 'Success';
  case EFETCH: return 'Fetch error';
  case ENET: return 'Network error';
  case ENOACCEPT: return 'Request not acceptable';
  case EOFFLINE: return 'Offline error';
  case EPARSEXML: return 'XML parsing error';
  case EPARSEFEED: return 'Feed parsing error';
  case EPARSEHTML: return 'HTML parsing error';
  case EPARSEOPML: return 'OPML parsing error';
  case EPOLICY: return 'Policy violation error';
  case ETIMEOUT: return 'Timeout error';
  case EDBCONSTRAINT: return 'Database constraint error';
  case EDBOPEN: return 'Database opening error';
  case EINVALIDSTATE: return 'Invalid state';
  case EINVAL: return 'Invalid input value';
  case EDB: return 'Database error';
  case EFAVICON: return 'Favicon lookup error';
  default: return 'Unknown status ' + status;
  }
}
