// The carousel at the top of Home: five lines about sharing the load, each shown with a photograph of two parents with their newborn. The photos are the team's own picks (see docs/photo-credits.md).
//
// To change a photo, replace the file in public/slides/ or point `image` at a new one.
//   pos:  where the photo is cropped, from the top (0%) to the bottom (100%), so faces stay in view
//   credit: optional. Shown small on the photo, and needed for any photo that asks for one.
// A slide without an `image` falls back to a drawn scene (`art`).

export const SLIDES = Object.freeze([
  {
    id: "hand-it-back",
    label: "Handing it over",
    text: "You don’t balance parenthood alone. You hand it back and forth until it’s light enough to carry.",
    image: "/slides/hand-it-back.jpg",
    alt: "A mother holds her sleeping baby by a bright window while the father stands close behind her, smiling.",
    pos: "50% 25%",
  },
  {
    id: "showing-up",
    label: "Showing up",
    text: "Support is not showing up when it’s convenient. It’s showing up when you’re also exhausted.",
    image: "/slides/showing-up.jpg",
    alt: "A father rests behind a mother on the bed, a hand on their sleeping baby, who lies on her chest.",
    pos: "50% 25%",
  },
  {
    id: "tap-out",
    label: "Tapping out",
    text: "Strength is not doing it alone. It’s knowing when to tap out.",
    image: "/slides/tap-out.jpg",
    alt: "A mother and father lie on either side of their baby, resting and smiling at each other.",
    pos: "50% 20%",
  },
  {
    id: "ask-for-help",
    label: "Asking for help",
    text: "Asking for help isn’t losing. It’s the whole point of having a partner.",
    image: "/slides/ask-for-help.jpg",
    alt: "A mother laughs as she holds her baby, and the father beside her laughs and reaches towards them.",
    pos: "50% 25%",
  },
  {
    id: "together",
    label: "Together",
    text: "You’re allowed to struggle and still be doing this right — together.",
    image: "/slides/together.jpg",
    alt: "A mother cradles her sleeping baby with her cheek on its head while the father leans in with a smile.",
    pos: "50% 22%",
  },
]);
