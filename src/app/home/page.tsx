import HomeFeaturedSignalAttachment from "@/components/home-featured-signal-attachment";
import HomeCompactClient from "./home-compact-client";
import "./home-compact.css";
import "./home-compact-polish.css";
import "./home-featured-signal-attachment.css";

export default function HomePage() {
  return (
    <>
      <HomeCompactClient />
      <HomeFeaturedSignalAttachment />
    </>
  );
}
