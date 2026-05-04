import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-background/50">
      <div className="mx-auto max-w-md px-6 py-8 flex flex-col gap-4 text-center">
        <p className="font-display font-bold text-sm gradient-text">MeSticker</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/refunds" className="hover:text-foreground">
            Refunds
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
        </div>
        <p className="text-[10px] text-muted-foreground">
          © {new Date().getFullYear()} MeSticker · Made with care · Ships from the US
        </p>
      </div>
    </footer>
  );
}
