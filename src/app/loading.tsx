import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";

export default function Loading() {
  return (
    <LoombusLoadingScreen
      title="Bringing the signal into focus."
      message="Preparing Loombus with clearer context, cleaner navigation, and less noise."
      waitLabel="Loading"
    />
  );
}
