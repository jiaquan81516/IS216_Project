import { defineComponent, h } from "vue";

// A flower for each stage of a check-in, drawn loose, like a pen sketch: uneven petals, a leaning stem,
// a second faint line beside it. The stem and leaves stay the same for every stage and only the head
// changes: it closes, opens, blooms, droops, then bows. Decorative (aria-hidden): the mood is always
// named in words beside it.
// Line colour: navy while all is well (a muted blue-grey for a bud), terracotta for a drooping head and a
// faded one for a wilted one, so only a struggling parent gets the warm colour.
const COLOUR = {
  budding: "#8d9bb3",
  opening: "#1f3a68",
  bloom: "#1f3a68",
  drooping: "#b5532f",
  wilted: "#b08572",
};
const STEM = { budding: "#8d9bb3", opening: "#5d6f8a", bloom: "#5d6f8a", drooping: "#8a7a70", wilted: "#a39286" };

// The same flowers in light lines, for use straight on the deep blue page.
const COLOUR_DARK = { budding: "#9fb0cc", opening: "#f6d8c6", bloom: "#fbf3e6", drooping: "#f0906c", wilted: "#b3a294" };
const STEM_DARK = { budding: "#9fb0cc", opening: "#9fb0cc", bloom: "#b9c8e0", drooping: "#b3a294", wilted: "#a39a8e" };

const PETAL = "M0 0 C-10 -9 -9 -26 0 -34 C9 -26 10 -9 0 0 Z";

export default defineComponent({
  name: "MoodFlower",
  props: { stage: { type: String, default: "budding" }, onDark: { type: Boolean, default: false } },
  setup(props) {
    return () => {
      const stage = COLOUR[props.stage] ? props.stage : "budding";
      const head = (props.onDark ? COLOUR_DARK : COLOUR)[stage];
      const ink = { fill: "none", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" };
      const stemInk = { ...ink, stroke: (props.onDark ? STEM_DARK : STEM)[stage] };
      const headInk = { ...ink, stroke: head };
      const wash = { fill: head, "fill-opacity": 0.08 };

      // petals around (cx, cy). `base` turns the whole flower, `angles` are the petals, `grow` their size.
      const petals = (cx, cy, base, angles, grow = 1, centre = true) => [
        ...angles.map((a, i) => {
          const wobble = [1, 0.93, 1.06, 0.96, 1.02, 0.9, 1.04][i % 7];
          return h("path", { ...headInk, ...wash, d: PETAL, transform: `translate(${cx} ${cy}) rotate(${base + a}) scale(${grow * wobble})` });
        }),
        centre ? h("circle", { ...headInk, cx, cy, r: 7 * grow }) : null,
        centre ? h("circle", { cx, cy, r: 2.4 * grow, fill: head }) : null,
      ];

      const leaves = [
        h("path", { ...stemInk, d: "M62 170 C46 168 38 156 36 148 C50 148 60 156 62 170" }),
        stage === "wilted" ? null : h("path", { ...stemInk, d: "M64 144 C80 142 90 130 92 122 C78 122 66 130 64 144" }),
      ];

      let stem = "M62 198 C56 160 70 125 61 76";
      let echo = "M64 198 C58 160 72 126 63 80";
      let top;
      if (stage === "budding") {
        stem = "M60 198 C58 150 62 110 60 80";
        echo = "M62 198 C60 150 64 110 62 82";
        top = [
          h("path", { ...headInk, ...wash, d: "M60 80 C46 72 46 42 60 22 C74 42 74 72 60 80 Z" }),
          h("path", { ...headInk, d: "M60 80 C52 84 48 88 44 94 M60 80 C68 84 72 88 76 94" }),
        ];
      } else if (stage === "opening") {
        stem = "M60 198 C58 150 64 112 61 80";
        echo = "M62 198 C60 150 66 112 63 82";
        top = [
          h("path", { ...headInk, ...wash, d: "M61 80 C44 76 38 52 46 36 C52 44 58 52 61 62 Z" }),
          h("path", { ...headInk, ...wash, d: "M61 80 C78 76 84 52 76 36 C70 44 64 52 61 62 Z" }),
          h("path", { ...headInk, ...wash, d: "M61 80 C48 66 50 40 61 24 C72 40 74 66 61 80 Z" }),
        ];
      } else if (stage === "bloom") {
        top = petals(61, 58, 0, [0, 51, 103, 155, 206, 258, 309]);
      } else if (stage === "drooping") {
        stem = "M54 198 C52 150 58 100 76 62 C88 40 106 48 100 74";
        echo = "M56 198 C54 150 60 100 78 64 C90 44 108 52 102 76";
        top = petals(100, 84, 180, [-66, -33, 0, 33, 66], 0.82);
      } else {
        stem = "M60 198 C60 150 56 112 40 98 C26 86 12 100 18 126";
        echo = "M62 198 C62 150 58 114 42 100 C28 88 14 102 20 128";
        top = petals(18, 134, 180, [-52, -18, 18, 52], 0.62);
      }

      return h(
        "svg",
        { class: ["flower", `flower--${stage}`], viewBox: "0 0 120 200", "aria-hidden": "true", focusable: "false" },
        [
          h("path", { ...stemInk, "stroke-width": 1.2, opacity: 0.45, d: echo }),
          h("path", { ...stemInk, d: stem }),
          ...leaves,
          ...top,
        ],
      );
    };
  },
});
