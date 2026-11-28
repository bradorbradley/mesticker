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
    /** printed trim around the sheet (transparent PNG, 1170x2010: the printable area) */
    frame?: string;
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
  /** the poses on the event sheet, instead of the usual per-person ideas */
  poses?: string[];
  /** one more sticker: the guest together with the hosts (made from their images) */
  groupPose?: string;
  /** poses (by index) that get the guest's name on a ribbon */
  namePoses?: number[];
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
      frame: "/events/carol/frame.png",
      hosts: [
        // Fred and Alex are the twins; Augustine has the dark curly hair
        { name: "Fred", img: "/events/carol/host-left.webp" },
        { name: "Augustine", img: "/events/carol/host-middle.webp" },
        { name: "Alex", img: "/events/carol/host-right.webp" },
      ],
      cameo: { name: "Santa", img: "/events/carol/host-santa.webp" },
      scene: "/events/carol/scene.webp",
      scenes: { street: "/events/carol/scene-street.webp", roof: "/events/carol/scene-roof.webp" },
      music: "/events/carol/music.mp3",
      invite: "/events/carol/invite.jpg",
    },
    // the order matters: the sheet, the story and the games use these by index
    poses: [
      "riding a flying reindeer across a huge glowing full moon, waving, scarf flying, inside a round badge with a deep blue starry night-sky background",
      "popping out of a giant red Christmas stocking with a white fluffy cuff, arms up, inside a round badge with a warm cozy fireplace background",
      "their happy face peeking out of a shiny red glass Christmas ornament bauble with a gold cap and a ribbon bow on top",
      "racing downhill on a wooden sled, snow spraying everywhere, huge excited grin, motion lines",
      "throwing a snowball mid-throw with a mischievous grin, snow flying",
      "standing on a little ladder placing a glowing gold star on top of a small decorated Christmas tree",
      "ice skating on one leg with arms out wide, sparkles trailing from the skates",
      "a tiny version of themself waving inside a glass snow globe with falling snow and a wooden base",
      "as a cute gingerbread cookie version of themself with white icing details and gumdrop buttons",
      "wearing a Santa hat and cozy scarf, sipping hot cocoa with marshmallows from a big mug, rosy cheeks",
      "bursting out of a wrapped Christmas present with a big red bow, confetti flying, arms wide",
    ],
    groupPose: "the guest standing in the middle with the three choir singers around them, all four singing Christmas carols together holding lit candles and open songbooks, joyful, musical notes floating around them",
    namePoses: [0, 1, 2],
  },
};

export const getPartyEvent = (slug: unknown): PartyEvent | null => (typeof slug === "string" && PARTY_EVENTS[slug]) || null;
