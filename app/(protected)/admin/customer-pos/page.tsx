import { redirect } from "next/navigation";

export default function CustomerPOsRedirect() {
  redirect("/admin/customer-pos/list");
}
