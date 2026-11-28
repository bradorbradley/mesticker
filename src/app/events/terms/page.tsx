import Link from "next/link";
import LegalPage from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Event Booking Terms · MeSticker",
  description: "Booking terms for the MeSticker cartoon sticker photo booth at your event: quotes, deposits, cancellations, venue needs and liability.",
};

const mail = <a href={`mailto:${LEGAL.email}`} className="font-semibold text-primary">{LEGAL.email}</a>;

export default function EventTermsPage() {
  return (
    <LegalPage
      title="Event Booking Terms"
      intro={
        <p>
          These terms apply when you (the &quot;Client&quot;) book {LEGAL.business} to bring our cartoon sticker photo booth to an event. Your
          written quote or booking confirmation sets the date, hours, package and price; if it says something different from these terms, the
          quote wins. Our <Link href="/terms" className="font-semibold text-primary">Terms of Service</Link> and{" "}
          <Link href="/privacy" className="font-semibold text-primary">Privacy Policy</Link> also apply.
        </p>
      }
      sections={[
        {
          id: "booking",
          title: "Quotes and booking",
          body: (
            <p>
              Quotes are valid for 14 days. Your date is reserved only once you&apos;ve accepted the quote and paid the deposit. Prices depend on
              hours, guest count, location, travel and any custom styles or branding.
            </p>
          ),
        },
        {
          id: "payment",
          title: "Deposit and payment",
          body: (
            <ul>
              <li>A 50% deposit is due to reserve your date.</li>
              <li>The balance is due 7 days before the event (or at booking, for events less than 7 days away).</li>
              <li>Extra time on the day, if we can stay, is billed at the hourly rate in your quote.</li>
              <li>Travel, parking, tolls and venue fees outside our service area are billed as quoted.</li>
            </ul>
          ),
        },
        {
          id: "cancel",
          title: "Cancelling or rescheduling",
          body: (
            <ul>
              <li><b>30 or more days before the event:</b> full refund of the deposit, less any custom design work already done.</li>
              <li><b>Less than 30 days before:</b> the deposit is non-refundable, because we turn down other bookings for your date.</li>
              <li><b>Less than 7 days before:</b> the full amount is due.</li>
              <li><b>Rescheduling:</b> you can move your booking once to another available date within 12 months at no charge if you tell us at least 14 days ahead.</li>
              <li><b>If we cancel</b> for any reason, you get a full refund of everything you paid, and that is the limit of what we owe.</li>
            </ul>
          ),
        },
        {
          id: "venue",
          title: "What the venue needs",
          body: (
            <ul>
              <li>An indoor or covered space about 6 × 6 ft with a table about 6 ft long.</li>
              <li>A standard power outlet within reach, and Wi-Fi or decent cell signal.</li>
              <li>Access about 45 minutes before the start time for setup, and about 30 minutes after for packing up.</li>
              <li>Any venue permits, approvals or insurance certificates the venue requires. Please tell us about them when you book so we can arrange anything needed.</li>
            </ul>
            ),
        },
        {
          id: "day",
          title: "On the day",
          body: (
            <>
              <p>
                An attendant runs the booth for the hours booked. Each sheet takes about 2 minutes to print and cut, so a booth can make roughly 25
                sheets an hour; we can&apos;t guarantee every guest gets a sheet during a busy event. Guest-paid packages let guests buy sheets on
                their phones; hosted packages include sheets for guests up to the amount in your quote.
              </p>
              <p>
                We may pause or end service if conditions are unsafe, equipment is threatened, or guests behave abusively, and we may refuse photos
                that break our Terms of Service. Time lost for these reasons isn&apos;t refundable.
              </p>
            </>
          ),
        },
        {
          id: "guests",
          title: "Guests, photos and privacy",
          body: (
            <ul>
              <li>Taking part is voluntary. Guests choose whether to take a photo, and we post a sign at the booth explaining how photos are used.</li>
              <li>Guests&apos; photos are handled as our Privacy Policy describes and deleted automatically within about {LEGAL.retentionDays} days.</li>
              <li>If you&apos;d like a digital gallery of the stickers, tell us when booking. You agree to use it only for your event and not for advertising without guests&apos; permission.</li>
              <li>Children under 13 must have a parent or guardian present at the booth.</li>
              <li>We&apos;ll only use photos from your event in our own marketing with your written OK and the permission of anyone shown.</li>
              <li>
                For free (host-paid) events we may ask guests to sign up with an email before their photo. Guests choose separately whether we may
                feature them on social media and whether to get marketing emails; we keep a record of each choice. We&apos;ll put up a small sign
                at the booth saying we may photograph or film it, and we only post guests who said yes.
              </li>
            </ul>
          ),
        },
        {
          id: "branding",
          title: "Custom styles and branding",
          body: (
            <p>
              If you give us a logo, names, artwork or a theme to use, you confirm you have the right to use it and you allow us to use it for your
              event. Custom styles are approved by you in advance; once approved, changes may cost extra. AI-made stickers are artistic and will vary
              from guest to guest.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Equipment and liability",
          body: (
            <>
              <p>
                You&apos;re responsible for damage to our equipment caused by your guests or venue, other than normal wear. We&apos;re responsible
                for damage our team causes. To the fullest extent the law allows, our total liability for any booking is limited to the amount you
                paid for it, and we aren&apos;t liable for indirect or consequential losses.
              </p>
              <p>
                If something outside our reasonable control (severe weather, illness, accidents, power or internet outages, venue closures) stops us
                from performing, we&apos;ll offer a new date or refund the amount for any service we couldn&apos;t provide.
              </p>
            </>
          ),
        },
        {
          id: "contact",
          title: "Questions",
          body: <p>Email {mail} about your booking. Disputes are handled as described in section 12 of our Terms of Service.</p>,
        },
      ]}
    />
  );
}
