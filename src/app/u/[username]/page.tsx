import PublicProfileV2Client from "./public-profile-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function UserProfilePage() {
  return <PublicProfileV2Client />;
}
