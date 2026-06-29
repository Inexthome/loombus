import { redirect } from "next/navigation";

export default function CreateReadinessRedirect() {
  redirect("/v2/create/review");
}
