import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Shopping list" };

export default function ShoppingPage() {
  return (
    <>
      <PageHeader title="Shopping list" subtitle="Tap to tick off · swipe left to delete · hold to edit" />
      <PageBody>
        <Card className="mx-auto max-w-2xl p-4 md:p-5">
          <ShoppingList />
        </Card>
      </PageBody>
    </>
  );
}
