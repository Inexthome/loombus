import { redirect } from "next/navigation";

export default function CreateConfirmRedirect() {
  redirect("/v2/create/review");
}
