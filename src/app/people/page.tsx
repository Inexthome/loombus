import PeopleClientPage from "./client-page";
import "./people-v2-shell.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PeoplePage() {
  return <PeopleClientPage />;
}
