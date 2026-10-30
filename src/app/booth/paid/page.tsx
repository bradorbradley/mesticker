/** Shown on the guest's phone after Stripe Checkout. */
export default async function BoothPaidPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  return (
    <div className="booth flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/booth/mascot.webp" alt="" className="h-56 object-contain" />
      <h1 className="display text-5xl leading-tight">
        {canceled ? (
          <>
            No worries, <em className="italic text-[var(--coral)]">nothing charged.</em>
          </>
        ) : (
          <>
            You&apos;re all set! <em className="italic text-[var(--coral)]">Look up.</em>
          </>
        )}
      </h1>
      <p className="max-w-[28ch] text-xl text-[var(--ink-2)]">
        {canceled
          ? "Scan the code on the booth screen again whenever you're ready."
          : "Your stickers are printing at the booth right now. Your receipt is on its way to your email."}
      </p>
    </div>
  );
}
