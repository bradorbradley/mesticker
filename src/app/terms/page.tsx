import Link from "next/link";
import LegalPage from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Terms of Service · MeSticker",
  description: "The terms for using MeSticker online, at the sticker photo booth and at events.",
};

const mail = <a href={`mailto:${LEGAL.email}`} className="font-semibold text-primary">{LEGAL.email}</a>;
const L = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-semibold text-primary">
    {children}
  </Link>
);

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms are an agreement between you and {LEGAL.business} for using {LEGAL.site}, our cartoon sticker photo booth, and our event
          services. By using any of them you agree to these terms and to our <L href="/privacy">Privacy Policy</L>. Please read section 12: it
          explains that most disputes are resolved by individual arbitration, not class actions or jury trials.
        </p>
      }
      sections={[
        {
          id: "service",
          title: "What MeSticker does",
          body: (
            <p>
              MeSticker uses AI image tools to turn photos into cartoon-style stickers. Online, we ship printed sticker sheets to you. At the
              booth and at events, sheets are printed and cut on the spot. Event bookings are also covered by our{" "}
              <L href="/events/terms">Event Booking Terms</L>.
            </p>
          ),
        },
        {
          id: "eligibility",
          title: "Who can use it",
          body: (
            <p>
              You must be at least 13 to use MeSticker. If you&apos;re under 18, you need a parent or guardian&apos;s permission, and a parent or
              guardian must make any purchase. Children under 13 may use the booth only with a parent or guardian present, who accepts these terms
              for them. If you use MeSticker for a company, you confirm you can accept these terms on its behalf.
            </p>
          ),
        },
        {
          id: "content",
          title: "Your photos and what you may upload",
          body: (
            <>
              <p>You keep ownership of your photos. By using MeSticker you confirm that:</p>
              <ul>
                <li>you took the photo or have the right to use it;</li>
                <li>everyone recognizable in it has agreed to be turned into stickers (and a parent or guardian has agreed for any minor);</li>
                <li>it doesn&apos;t show nudity, sexual content, violence, hate symbols or illegal activity, and isn&apos;t meant to harass, bully, impersonate or mislead;</li>
                <li>it doesn&apos;t infringe anyone&apos;s copyright, trademark, privacy or publicity rights.</li>
              </ul>
              <p>
                You give us a limited license to store, process and print your photo and stickers, and to send them to our service providers,
                only to provide the service to you. This license ends when the images are deleted as described in our Privacy Policy. We may
                refuse, stop or cancel (with a refund) anything we believe breaks these rules, and AI providers may block some photos
                automatically.
              </p>
            </>
          ),
        },
        {
          id: "ai",
          title: "About AI-made stickers",
          body: (
            <>
              <p>
                Stickers are created by AI and are artistic interpretations, not exact likenesses. Results vary, and features, clothing, colors or
                details may differ from your photo. Occasionally the AI makes mistakes, such as stray marks or garbled text. Please check your
                on-screen preview before you pay; what you see is what we print.
              </p>
              <p>
                Our cartoon styles are original interpretations of general art styles. MeSticker is not affiliated with, sponsored by or endorsed
                by any studio, show, character or brand, and all trademarks belong to their owners. Please don&apos;t ask us to recreate
                copyrighted characters or logos you don&apos;t have rights to.
              </p>
            </>
          ),
        },
        {
          id: "use",
          title: "Using your stickers",
          body: (
            <p>
              Your stickers and the digital images of them are for your personal, non-commercial use: stick them, share them and post them freely.
              Reselling them, or using them to advertise a product, needs our written permission. Branded event sheets made for a company may be used
              by that company as agreed in its booking.
            </p>
          ),
        },
        {
          id: "orders",
          title: "Prices, payment and orders",
          body: (
            <ul>
              <li>Prices are in U.S. dollars and shown before you pay. Taxes are added where required.</li>
              <li>Payments are processed by Stripe. You authorize us to charge the payment method you choose.</li>
              <li>Because every sheet is made just for you, booth orders start printing the moment payment is confirmed and online orders go to print shortly after, so orders can&apos;t be changed or canceled once paid.</li>
              <li>Shipped orders: delivery times are estimates, and the risk of loss passes to you when the package is delivered.</li>
              <li>If something goes wrong, our <L href="/refunds">Refund Policy</L> explains your options.</li>
            </ul>
          ),
        },
        {
          id: "accounts",
          title: "Accounts",
          body: (
            <p>
              If you sign in, keep your account secure; you&apos;re responsible for activity on it. You can delete your account and its data at any
              time by emailing {mail}. We may suspend accounts that break these terms.
            </p>
          ),
        },
        {
          id: "conduct",
          title: "Things you may not do",
          body: (
            <ul>
              <li>break the law or anyone else&apos;s rights while using MeSticker;</li>
              <li>try to bypass payments, rate limits or content filters, or overload, scrape or reverse-engineer the service;</li>
              <li>use MeSticker to make deceptive images of real people;</li>
              <li>damage or tamper with booth equipment.</li>
            </ul>
          ),
        },
        {
          id: "ip",
          title: "Our property",
          body: (
            <p>
              The MeSticker name, logo, mascot, website, booth software and designs belong to us. These terms don&apos;t give you any right to use
              them except to use the service as intended. If you send us feedback or ideas, we may use them without owing you anything.
            </p>
          ),
        },
        {
          id: "disclaimers",
          title: "Disclaimers",
          body: (
            <p>
              Except as stated in our Refund Policy, MeSticker is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of
              any kind, including merchantability, fitness for a particular purpose, and non-infringement, to the fullest extent the law allows. We
              don&apos;t promise the service will always be available or error-free, or that stickers will suit every surface. Stickers are not
              toys; keep them away from young children who might swallow them.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Limits on our liability",
          body: (
            <>
              <p>
                To the fullest extent the law allows, we aren&apos;t liable for indirect, incidental, special, consequential or punitive damages, or
                for lost profits, data or goodwill. Our total liability for any claim relating to MeSticker is limited to the greater of the amount
                you paid us for the order or booking involved, or $100.
              </p>
              <p>
                You agree to indemnify us against claims arising from photos you provide, your misuse of the service, or your breach of these terms.
                Some places don&apos;t allow some of these limits, so they may not all apply to you.
              </p>
            </>
          ),
        },
        {
          id: "disputes",
          title: "Disputes and arbitration",
          body: (
            <>
              <p>
                <b>Talk to us first.</b> Most problems can be fixed quickly: email {mail} and give us 30 days to try to resolve it.
              </p>
              <p>
                <b>Arbitration.</b> If we can&apos;t resolve it, you and we agree that any dispute relating to MeSticker will be decided by binding
                individual arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, rather than in
                court. Either of us may instead bring an individual claim in small-claims court. <b>You and we waive any right to a jury trial and to
                take part in a class action or class arbitration.</b>
              </p>
              <p>
                <b>Opt out.</b> You can opt out of this arbitration agreement by emailing {mail} within 30 days of first using MeSticker, with your
                name and the words &quot;arbitration opt-out&quot;.
              </p>
              <p>
                These terms are governed by the laws of the State of {LEGAL.state} and applicable federal law, including the Federal Arbitration Act.
                Any claims that aren&apos;t arbitrated will be heard in the state or federal courts located in {LEGAL.state}.
              </p>
            </>
          ),
        },
        {
          id: "general",
          title: "Changes and everything else",
          body: (
            <p>
              We may update these terms; the date at the top shows the latest version, and continuing to use MeSticker means you accept the changes.
              If part of these terms can&apos;t be enforced, the rest still applies. Not enforcing a term isn&apos;t a waiver. These terms, the
              Privacy Policy, the Refund Policy and (for bookings) the Event Booking Terms are the whole agreement between us. Neither of us is
              responsible for delays caused by events beyond our reasonable control.
            </p>
          ),
        },
      ]}
    />
  );
}
