/** Shown instantly while a page loads, so taps on the navigation feel immediate. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] md:p-8" aria-busy="true">
      <div className="skeleton h-9 w-48" />
      <div className="skeleton h-5 w-64" />
      <div className="skeleton mt-2 h-[50dvh] w-full rounded-[1.75rem]" />
    </div>
  );
}
