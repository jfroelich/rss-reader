export default function activate_feed(conn, id) {
  const props = {
    id: id,
    active: true,
    deactivateDate: undefined,
    deactivationReasonText: undefined
  };

  const overwrite_flag = false;
  return conn.updateFeed(props, overwrite_flag);
}
