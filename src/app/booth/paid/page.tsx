/** Shown on the guest's phone after Stripe Checkout. */
export default async function BoothPaidPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  return (
    <div className="booth fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 px-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/booth/mascot.webp" alt="" className="h-56 object-contain" />
      <h1 className="t-h2 !text-[40px]">
        {canceled ? (
          <>
            No worries, <span className="pop">nothing charged.</span>
          </>
        ) : (
          <>
            Paid! <span className="pop">You&apos;re all set.</span>
          </>
        )}
      </h1>
      <p className="max-w-[28ch] t-lead">
        {canceled
          ? "Scan the code on the booth screen again whenever you're ready."
          : "Go back to MeSticker (the booth screen, or your other tab) for your pickup number. Your receipt is on its way to your email."}
      </p>
    </div>
  );
}
