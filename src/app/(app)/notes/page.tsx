import type { Metadata } from "next";
import { NotesBoard } from "@/components/notes/notes-board";
import { PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <>
      <PageHeader title="Notes" subtitle="Quick notes – pin what you need often" />
      <PageBody>
        <NotesBoard />
      </PageBody>
    </>
  );
}
