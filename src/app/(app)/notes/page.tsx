import type { Metadata } from "next";
import { NotesBoard } from "@/components/notes/notes-board";
import { NotesTrashButton } from "@/components/notes/notes-trash";
import { FillPage, PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <FillPage>
      <PageHeader title="Notes" subtitle="Quick notes – pin what you need often" actions={<NotesTrashButton />} />
      <PageBody className="max-md:flex max-md:flex-1 max-md:flex-col max-md:pb-3">
        <NotesBoard className="flex-1" />
      </PageBody>
    </FillPage>
  );
}
