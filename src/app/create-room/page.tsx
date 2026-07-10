import { redirect } from "next/navigation";

export default function CreateRoomRedirectPage() {
  redirect("/rooms/new");
}
