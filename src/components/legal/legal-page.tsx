import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LEGAL } from "@/lib/legal";

/** Shared layout for Privacy, Terms, Refunds and Event terms: title, date, contents, sections. */
export default function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: React.ReactNode;
  sections: { id: string; title: string; body: React.ReactNode }[];
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft size={14} /> Back to MeSticker
      </Link>
      <h1 className="mb-1 font-display text-3xl font-bold">{title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">Last updated {LEGAL.updated}</p>
      {intro && <div className="mb-6 text-sm leading-relaxed">{intro}</div>}
      <nav className="mb-8 rounded-2xl bg-primary/5 p-4 text-sm">
        <p className="mb-2 font-semibold">Contents</p>
        <ol className="ml-5 list-decimal space-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="space-y-8 text-sm leading-relaxed [&_li]:mb-1 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2 className="mb-2 text-base font-bold">
              {i + 1}. {s.title}
            </h2>
            <div className="space-y-3">{s.body}</div>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        Questions? Email{" "}
        <a href={`mailto:${LEGAL.email}`} className="font-semibold text-primary">
          {LEGAL.email}
        </a>
        .
      </p>
    </main>
  );
}
