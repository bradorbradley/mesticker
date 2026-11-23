import Link from "next/link";
import LegalPage from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Refund Policy · MeSticker",
  description: "Refunds and reprints for MeSticker online orders, booth prints and events.",
};

const mail = <a href={`mailto:${LEGAL.email}`} className="font-semibold text-primary">{LEGAL.email}</a>;

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund Policy"
      intro={<p>Every sheet is made just for you, so we can&apos;t take returns, but if something is wrong on our side we&apos;ll make it right.</p>}
      sections={[
        {
          id: "booth",
          title: "At the photo booth",
          body: (
            <ul>
              <li><b>Misprint, bad cut or jammed sheet:</b> tell the attendant and we&apos;ll reprint it on the spot for free.</li>
              <li><b>Paid but nothing printed</b> (for example the printer went down): we&apos;ll print it as soon as we can, or refund you in full if we can&apos;t.</li>
              <li><b>Charged twice:</b> email {mail} with the time and the last 4 digits of your card and we&apos;ll refund the duplicate.</li>
            </ul>
          ),
        },
        {
          id: "online",
          title: "Online orders",
          body: (
            <ul>
              <li><b>Damaged, misprinted or defective:</b> email {mail} within 30 days of delivery with your order number and a photo, and we&apos;ll send a free replacement or refund you.</li>
              <li><b>Lost or never arrived:</b> if it hasn&apos;t arrived 14 business days after shipping, we&apos;ll reship it or refund you.</li>
              <li><b>Wrong address:</b> we can&apos;t cover orders shipped to an address entered incorrectly, but we&apos;ll help however we can.</li>
            </ul>
          ),
        },
        {
          id: "custom",
          title: "Things we can't refund",
          body: (
            <p>
              Because stickers are custom-made from your photo, we don&apos;t offer refunds for changing your mind or because the cartoon isn&apos;t
              exactly what you imagined. You see the full sheet before you pay, so please check it first. Generating previews is free.
            </p>
          ),
        },
        {
          id: "events",
          title: "Event bookings",
          body: (
            <p>
              Deposits, cancellations and rescheduling for events are covered by our{" "}
              <Link href="/events/terms" className="font-semibold text-primary">Event Booking Terms</Link>.
            </p>
          ),
        },
        {
          id: "how",
          title: "How refunds work",
          body: (
            <p>
              Email {mail}. We reply within 2 business days. Approved refunds go back to your original payment method through Stripe and usually show
              up within 5–10 business days. Nothing here limits any rights you have under consumer protection law.
            </p>
          ),
        },
      ]}
    />
  );
}
