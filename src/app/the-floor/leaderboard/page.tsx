import type { Metadata } from "next";
import TheFloorLeaderboardPage from "@/components/the-floor-leaderboard-page";

export const metadata: Metadata = {
  title: "The Floor Leaderboard | Loombus",
  description:
    "Member track records on The Floor, computed live from resolved falsifiable calls. Never a house rating.",
};

export default function TheFloorLeaderboardRoute() {
  return <TheFloorLeaderboardPage />;
}
