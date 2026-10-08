import type { Metadata } from "next";
import { NotesBoard } from "@/components/notes/notes-board";
import { NotesTrashButton } from "@/components/notes/notes-trash";
import { FILL_BODY, FillPage, PageBody, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <FillPage>
      <PageHeader title="Notes" subtitle="Quick notes – pin what you need often" actions={<NotesTrashButton />} />
      <PageBody className={FILL_BODY}>
        <NotesBoard className="min-h-0 flex-1" />
      </PageBody>
    </FillPage>
  );
}
