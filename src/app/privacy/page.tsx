import Link from "next/link";
import LegalPage from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy · MeSticker",
  description: "How MeSticker collects, uses, keeps and deletes your photos and information, on the website, at the photo booth and for events.",
};

const mail = <a href={`mailto:${LEGAL.email}`} className="font-semibold text-primary">{LEGAL.email}</a>;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          {LEGAL.business} (&quot;we&quot;, &quot;us&quot;) turns photos into cartoon stickers on {LEGAL.site}, at our sticker photo booth, and at
          events we&apos;re booked for. This policy explains what we collect, why, who we share it with, how long we keep it, and the choices you
          have. The short version: we use your photo only to make your stickers, we never sell your information, we don&apos;t use facial
          recognition, and photos are deleted automatically within about {LEGAL.retentionDays} days.
        </p>
      }
      sections={[
        {
          id: "collect",
          title: "What we collect",
          body: (
            <>
              <ul>
                <li><b>Photos you take or upload</b>, and the cartoon stickers and sticker sheets we make from them.</li>
                <li><b>Order details:</b> what you bought, the amount, and, for shipped orders, your name and shipping address. Payments are handled by Stripe; we never see or store your full card number.</li>
                <li><b>Contact details you give us:</b> your email if you ask us to email your stickers, sign in, or contact us; and for event inquiries, your name, email, phone number and event details.</li>
                <li><b>Account details</b> if you sign in with Google: your name, email and profile picture, so we can save your creations and orders.</li>
                <li><b>Usage information:</b> pages viewed, buttons tapped, device and browser type, and approximate location from your IP address, collected through our analytics provider. We use this to fix problems and improve the product.</li>
              </ul>
              <p>We don&apos;t ask for and don&apos;t want sensitive information such as government IDs, health information or financial account details.</p>
            </>
          ),
        },
        {
          id: "faces",
          title: "Photos, faces and AI",
          body: (
            <>
              <p>
                To turn your photo into a cartoon, we send it to an AI image service (currently OpenAI and Google), which returns the sticker
                images. These providers process your photo on our behalf under their business terms, which do not allow them to use our
                customers&apos; images to train their models by default. They may keep data for a short time (for example up to 30 days) to
                detect abuse.
              </p>
              <p>
                <b>We do not use facial recognition.</b> We don&apos;t create face templates, faceprints or any other biometric identifier, and
                we don&apos;t try to identify who is in a photo. A photo is used only to draw your cartoon.
              </p>
              <p>We never use your photo or stickers in our marketing unless you&apos;ve clearly told us we may.</p>
            </>
          ),
        },
        {
          id: "use",
          title: "How we use your information",
          body: (
            <ul>
              <li>To make, show, print and deliver your stickers, including printing them at the booth or shipping them to you.</li>
              <li>To take payments, send receipts and handle refunds.</li>
              <li>To email you your stickers when you ask us to.</li>
              <li>To answer event inquiries and plan events you book.</li>
              <li>To keep the service safe, prevent fraud and abuse, and fix bugs.</li>
              <li>To understand how the product is used so we can improve it.</li>
              <li>To comply with the law, such as keeping tax records.</li>
            </ul>
          ),
        },
        {
          id: "share",
          title: "Who we share it with",
          body: (
            <>
              <p>We don&apos;t sell your personal information, and we don&apos;t share it for targeted advertising. We share it only with the service providers that help us run MeSticker, and only what each one needs:</p>
              <ul>
                <li><b>OpenAI and Google</b>: generating the cartoon images</li>
                <li><b>Stripe</b>: payment processing</li>
                <li><b>Printful</b>: printing and shipping online orders</li>
                <li><b>Vercel and Neon</b>: hosting, databases and image storage</li>
                <li><b>Resend</b>: sending email</li>
                <li><b>PostHog</b>: product analytics (no photos are sent to it)</li>
                <li><b>Google</b>: sign-in, if you choose to sign in with Google</li>
              </ul>
              <p>We may also share information if the law requires it, to protect people&apos;s safety or our rights, or as part of a sale or merger of the business (in which case this policy would continue to apply).</p>
            </>
          ),
        },
        {
          id: "keep",
          title: "How long we keep it",
          body: (
            <ul>
              <li><b>Photos and generated stickers:</b> deleted automatically from our storage within about {LEGAL.retentionDays} days. Booth photos are only needed for the few minutes it takes to print.</li>
              <li><b>Saved creations</b> (if you sign in): kept until you delete them or ask us to; the images themselves still expire as above.</li>
              <li><b>Orders and payment records:</b> kept as long as needed for taxes, accounting and refunds, generally up to 7 years.</li>
              <li><b>Event inquiries:</b> kept for up to 2 years so we can follow up, or until you ask us to delete them.</li>
              <li><b>Analytics:</b> kept in aggregated or pseudonymous form.</li>
            </ul>
          ),
        },
        {
          id: "booth",
          title: "At the photo booth and at events",
          body: (
            <>
              <p>
                At the booth you can take a photo on our screen or scan a QR code to use your own phone. Your photo is processed exactly as
                described above and is not displayed publicly. If you pay on your phone, Stripe handles the payment; if you ask us to email your
                stickers, we use your email only for that.
              </p>
              <p>
                At private events, the host may choose to receive copies of guests&apos; stickers (for example for a digital gallery). We&apos;ll
                tell guests at the booth when that&apos;s the case. Hosts are responsible for how they use any copies they receive.
              </p>
            </>
          ),
        },
        {
          id: "children",
          title: "Children",
          body: (
            <p>
              MeSticker is not directed to children under 13, and we don&apos;t knowingly collect personal information from them online. Children
              under 13 may use the booth only with a parent or guardian present, who agrees on their behalf. If you believe a child has given us
              personal information without a parent&apos;s consent, email {mail} and we&apos;ll delete it.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Your choices and rights",
          body: (
            <>
              <p>Wherever you live, you can ask us to:</p>
              <ul>
                <li>tell you what personal information we have about you and give you a copy;</li>
                <li>correct it;</li>
                <li>delete it, including your photos, stickers, saved creations and account;</li>
                <li>stop using it for analytics.</li>
              </ul>
              <p>
                Email {mail} from the address you used with us. We&apos;ll respond within 30 days (within 45 days where state law allows) and
                won&apos;t treat you differently for making a request. You can also have an authorized agent make a request for you. California,
                Colorado, Connecticut, Virginia and other U.S. state residents have these rights by law; if we deny a request you may appeal by
                replying to our answer. People in the EU, UK and similar places can also complain to their local data-protection authority.
              </p>
              <p>We honor Global Privacy Control signals as a request to opt out of any sale or sharing; since we don&apos;t sell or share personal information for advertising, nothing more is needed.</p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies and local storage",
          body: (
            <p>
              We use a sign-in cookie if you sign in, your browser&apos;s local storage to remember your cart, gallery and booth settings, and
              analytics cookies to understand usage. We don&apos;t use third-party advertising cookies. You can clear these in your browser
              settings at any time.
            </p>
          ),
        },
        {
          id: "security",
          title: "Security and where data is stored",
          body: (
            <p>
              We use encryption in transit (HTTPS), access controls and reputable providers to protect your information, and we keep it only as
              long as described above. No system is perfectly secure, so we can&apos;t guarantee absolute security. Our providers store and
              process data in the United States; if you use MeSticker from elsewhere, your information is transferred to the U.S.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: (
            <p>
              We&apos;ll update the date at the top when we change this policy. If a change materially affects how we use information we already
              have, we&apos;ll tell you on the site or by email before it takes effect. See also our <Link href="/terms" className="font-semibold text-primary">Terms of Service</Link>.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: <p>{LEGAL.business}, email {mail}.</p>,
        },
      ]}
    />
  );
}
