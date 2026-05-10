import { redirect } from "next/navigation";

export default function ShipmentsRedirect() {
  redirect("/admin/shipments/list");
}
