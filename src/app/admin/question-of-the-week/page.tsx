import type { Metadata } from "next";
import QuestionOfWeekAdminClient from "./question-of-week-admin-client";
import QuestionOfWeekPushControl from "./question-of-week-push-control";

export const metadata: Metadata = {
  title: "Question of the Week | Loombus Admin",
  description: "Review, generate, replace, manually select, and announce Loombus Question of the Week editorial discussions.",
  robots: { index: false, follow: false },
};

export default function QuestionOfTheWeekAdminPage() {
  return (
    <>
      <QuestionOfWeekAdminClient />
      <QuestionOfWeekPushControl />
    </>
  );
}
