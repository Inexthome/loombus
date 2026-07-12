import PeopleV2Client from "./people-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PeoplePage() {
  return <PeopleV2Client />;
}
