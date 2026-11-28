/**
 * Booked events with their own booth link (mesticker.fun/booth/<slug>).
 *
 * free: the host prepaid, so guests never pay; orders print as soon as they're made.
 * collectGuest: before the camera, guests give an email (their stickers are emailed to them)
 * and see the consent checkboxes (terms, media release, marketing).
 * theme/style: fed to the image model like the staff panel's event settings.
 */
export interface PartyEvent {
  slug: string;
  name: string;
  /** shown on the sign-up screen, e.g. "December 12" */
  when?: string;
  free: boolean;
  collectGuest: boolean;
  theme?: string;
  style?: string;
  /** most orders one guest can make at this event */
  maxOrdersPerGuest: number;
  /** themed look: a CSS class on the booth (booth.css) and art in /public */
  look?: {
    themeClass: string;
    /** the event's logo sticker, printed at the top of every sheet */
    logo: string;
    /** the @mesticker.fun handle pill in the event's colours */
    pill: string;
    /** the hosts as chibi characters: the booth's mascots and the welcome video's cast */
    hosts: { name: string; img: string }[];
    /** a cameo in the welcome video (e.g. Santa) */
    cameo?: { name: string; img: string };
    /** welcome video backdrops: the party (home) and the adventure */
    scene?: string;
    scenes?: { street?: string; roof?: string };
    /** welcome video music (loops) */
    music?: string;
    /** the invite, shown on the start screen */
    invite?: string;
  };
  /** the 8 poses on the event sheet, instead of the usual per-person ideas */
  poses?: string[];
}

export const PARTY_EVENTS: Record<string, PartyEvent> = {
  christmascarol: {
    slug: "christmascarol",
    name: "387 Christmas Carols",
    free: true,
    collectGuest: true,
    when: "December 4",
    theme: "cozy Christmas: festive winter outfit in warm red and cream, a touch of holly",
    maxOrdersPerGuest: 3,
    look: {
      themeClass: "theme-carol",
      logo: "/events/carol/logo.png",
      pill: "/events/carol/handle-pill.png",
      hosts: [
        { name: "Fred", img: "/events/carol/host-left.webp" },
        { name: "Alex", img: "/events/carol/host-middle.webp" },
        { name: "Augustine", img: "/events/carol/host-right.webp" },
      ],
      cameo: { name: "Santa", img: "/events/carol/host-santa.webp" },
      scene: "/events/carol/scene.webp",
      scenes: { street: "/events/carol/scene-street.webp", roof: "/events/carol/scene-roof.webp" },
      music: "/events/carol/music.mp3",
      invite: "/events/carol/invite.jpg",
    },
    poses: [
      "riding a flying reindeer through the night sky, waving, scarf flapping in the wind",
      "standing on tiptoes hanging a shiny red ornament on a sparkling Christmas tree",
      "singing a carol with mouth wide open, holding an open songbook and a lit candle",
      "racing downhill on a wooden sled in the snow, huge excited grin",
      "throwing a snowball mid-throw, playful and mischievous",
      "hugging a giant wrapped present with a big red bow, eyes closed, delighted",
      "ice skating on one leg with arms out wide, joyful",
      "sipping hot cocoa with marshmallows from a cozy mug, wearing a Santa hat, rosy cheeks",
    ],
  },
};

export const getPartyEvent = (slug: unknown): PartyEvent | null => (typeof slug === "string" && PARTY_EVENTS[slug]) || null;
