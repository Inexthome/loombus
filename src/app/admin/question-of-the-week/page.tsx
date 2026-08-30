import type { Metadata } from "next";
import QuestionOfWeekAdminClient from "./question-of-week-admin-client";

export const metadata: Metadata = {
  title: "Question of the Week | Loombus Admin",
  description: "Review, generate, replace, and manually select Loombus Question of the Week editorial discussions.",
  robots: { index: false, follow: false },
};

export default function QuestionOfTheWeekAdminPage() {
  return <QuestionOfWeekAdminClient />;
}
