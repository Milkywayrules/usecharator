import type { Metadata } from "next";
import { CreateWizard } from "@/components/wizard/create-wizard";

export const metadata: Metadata = {
  title: "Create",
};

export default function CreatePage() {
  return <CreateWizard />;
}
