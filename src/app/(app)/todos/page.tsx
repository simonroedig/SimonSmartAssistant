import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { TodoList } from "@/components/todos/todo-list";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Backlog" };

export default function TodosPage() {
  return (
    <>
      <PageHeader title="Backlog" subtitle="Everything you want to get done – star what matters" />
      <PageBody>
        <Card className="mx-auto max-w-2xl p-4 md:p-5">
          <TodoList />
        </Card>
      </PageBody>
    </>
  );
}
