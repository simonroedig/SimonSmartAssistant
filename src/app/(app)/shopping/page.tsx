import type { Metadata } from "next";
import { FillPage, PageBody, PageHeader } from "@/components/shell/page-header";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Shopping list" };

export default function ShoppingPage() {
  return (
    <FillPage>
      <PageHeader title="Shopping list" subtitle="Tap to tick off · swipe left to delete · hold to edit" />
      <PageBody className="max-md:flex max-md:flex-1 max-md:flex-col max-md:pb-3">
        <Card className="mx-auto w-full max-w-2xl p-4 max-md:flex-1 md:p-5">
          <ShoppingList className="flex flex-1 flex-col" />
        </Card>
      </PageBody>
    </FillPage>
  );
}
