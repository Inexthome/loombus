import "./people-directory-grid.css";
import PeopleEditorialClient from "./people-editorial-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PeoplePage() {
  return <PeopleEditorialClient />;
}
