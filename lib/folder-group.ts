import mongoose from "mongoose";

/**
 * Given a VBNumber value (PO ObjectId or display string), return the list of
 * PO _id strings that belong to the same "sibling" folder group — including
 * the queried PO itself. If the PO isn't linked, returns just its own id.
 *
 * Used so that opening any linked record shows the combined Customer POs and
 * shipments of every member (records behave as one).
 */
export async function resolveGroupPoIds(vbNumber: string): Promise<string[]> {
  const vidapos = mongoose.connection.collection("vidapos");

  const orFilter: any[] = [{ VBNumber: vbNumber }, { folderGroupKey: vbNumber }];
  if (/^[a-fA-F0-9]{24}$/.test(vbNumber)) {
    orFilter.push({ _id: new mongoose.Types.ObjectId(vbNumber) });
  }
  const po = await vidapos.findOne(
    { $or: orFilter },
    { projection: { _id: 1, folderGroupKey: 1 } }
  );
  if (!po) return [vbNumber];

  if (!po.folderGroupKey) return [po._id.toString()];

  const members = await vidapos
    .find({ folderGroupKey: po.folderGroupKey }, { projection: { _id: 1 } })
    .toArray();
  return members.map((m: any) => m._id.toString());
}
