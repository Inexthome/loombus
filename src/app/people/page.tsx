import "./people-card-identity-cleanup.css";
import PeopleV2Client from "./people-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PeoplePage() {
  return (
    <div className="people-card-identity-cleanup">
      <PeopleV2Client />
    </div>
  );
}
