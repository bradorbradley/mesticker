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
    hosts: { name: string; img: string; cut?: string }[];
    /** a cameo in the welcome video (e.g. Santa) */
    cameo?: { name: string; img: string; cut?: string };
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
  /** stickers of the guest together with the hosts or the cameo (drawn from their images), after the poses */
  groups?: { idea: string; with: "hosts" | "cameo" }[];
  /** the sheet, slot by slot after the logo and the main sticker: sticker indexes (poses, then groups) */
  sheet?: number[];
  /** poses (by index) that get the guest's name on a ribbon */
  namePoses?: number[];
  /** other ideas for some pose slots, one picked per guest, so every sheet is a little different */
  poseAlts?: Record<number, string[]>;
}

export const PARTY_EVENTS: Record<string, PartyEvent> = {
  christmascarol: {
    slug: "christmascarol",
    name: "387 Christmas Carols",
    free: true,
    collectGuest: true,
    when: "December 4",
    theme: "cozy Christmas: festive winter outfit in warm red and cream, a touch of holly",
    maxOrdersPerGuest: 5,
    look: {
      themeClass: "theme-carol",
      logo: "/events/carol/logo.png",
      pill: "/events/carol/handle-pill.png",
      frame: "/events/carol/frame.png",
      hosts: [
        // Fred and Alex are the twins; Augustine has the dark curly hair
        { name: "Fred", img: "/events/carol/host-left.webp", cut: "/events/carol/host-left-cut.webp" },
        { name: "Augustine", img: "/events/carol/host-middle.webp", cut: "/events/carol/host-middle-cut.webp" },
        { name: "Alex", img: "/events/carol/host-right.webp", cut: "/events/carol/host-right-cut.webp" },
      ],
      cameo: { name: "Santa", img: "/events/carol/host-santa.webp", cut: "/events/carol/host-santa-cut.webp" },
      scene: "/events/carol/scene.webp",
      scenes: { street: "/events/carol/scene-street.webp", roof: "/events/carol/scene-roof.webp" },
      music: "/events/carol/music.mp3",
      invite: "/events/carol/invite.jpg",
    },
    // the order matters: the sheet and the story use these by index (0–6 solo, then 7–9 groups)
    poses: [
      // 0–2 get the guest's name on a ribbon
      "riding a flying reindeer across a huge glowing full moon, waving, scarf flying, inside a round badge with a deep blue starry night-sky background",
      "popping out of a giant red Christmas stocking with a white fluffy cuff, arms up, inside a round badge with a warm cozy fireplace background",
      "their happy face peeking out of a shiny red glass Christmas ornament bauble with a gold cap and a ribbon bow on top",
      // 3–5 action
      "racing downhill on a wooden sled, snow spraying everywhere, huge excited grin, motion lines",
      "winding up to throw a snowball mid-leap, mischievous grin, snow flying",
      "bursting out of a wrapped Christmas present with a big red bow, confetti flying, arms wide",
      // 6 a simple solo pose
      "wearing a Santa hat and cozy scarf, sipping hot cocoa with marshmallows from a big mug, rosy cheeks, waving",
    ],
    groups: [
      { with: "hosts", idea: "the guest in the middle of the three choir singers, all four singing Christmas carols together holding lit candles and open songbooks, joyful, musical notes floating around them" },
      { with: "hosts", idea: "the guest and the three choir singers each popping out of their own giant red Christmas stocking, four stockings hanging in a row on a fireplace mantel with garland, arms up, laughing" },
      { with: "cameo", idea: "the guest riding in Santa's red sleigh right next to Santa, both waving, presents piled behind them, flying over snowy rooftops past a huge full moon, inside a round badge with a starry night-sky background" },
    ],
    // after logo + main: carols group, the 3 name stickers, stockings group, sleigh, 4 solo poses (then the pill)
    sheet: [7, 0, 1, 2, 8, 9, 3, 4, 5, 6],
    namePoses: [0, 1, 2],
    // every sheet is a little different: some poses swap for an alternative per guest
    poseAlts: {
      3: ["snowboarding down a snowy hill doing a jump, scarf flying, motion lines", "zooming down a snowy hill on a toboggan, arms up, snow spraying"],
      4: ["ducking behind a snow fort with an armful of snowballs, cheeky grin", "mid snowball fight, a snowball splatting nearby, laughing"],
      5: ["ice skating in a spin with sparkles trailing from the skates", "jumping for joy over a pile of wrapped presents, arms up"],
      6: [
        "holding a big striped candy cane and waving, cozy winter sweater",
        "wearing reindeer antlers and a glowing red nose, giggling",
        "hugging a cute snowman with a top hat and carrot nose",
      ],
    },
  },
};

export const getPartyEvent = (slug: unknown): PartyEvent | null => (typeof slug === "string" && PARTY_EVENTS[slug]) || null;
