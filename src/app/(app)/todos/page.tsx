import type { Metadata } from "next";
import { FillPage, PageBody, PageHeader } from "@/components/shell/page-header";
import { TodoList } from "@/components/todos/todo-list";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Backlog" };

export default function TodosPage() {
  return (
    <FillPage>
      <PageHeader title="Backlog" subtitle="Everything you want to get done – star what matters" />
      <PageBody className="max-md:flex max-md:flex-1 max-md:flex-col max-md:pb-3">
        <Card className="mx-auto w-full max-w-2xl p-4 max-md:flex-1 md:p-5">
          <TodoList className="flex flex-1 flex-col" />
        </Card>
      </PageBody>
    </FillPage>
  );
}
