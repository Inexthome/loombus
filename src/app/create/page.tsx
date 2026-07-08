import { V2AppearanceProvider } from "../v2/v2-appearance";
import V2CreateClientPage from "../v2/create/client-page";
import CreatePublicPolish from "../v2/create/create-public-polish";

export default function CreatePage() {
  return (
    <V2AppearanceProvider>
      <CreatePublicPolish />
      <V2CreateClientPage />
    </V2AppearanceProvider>
  );
}
