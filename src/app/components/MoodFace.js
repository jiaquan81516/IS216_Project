import { defineComponent, h } from "vue";

// A mood as a simple drawn face, from very low (1) to great (5). Decorative (aria-hidden): the
// mood is always named in text beside it. With no level it is a faded neutral face.
const FILL = ["#dfe3ea", "#e9e5ec", "#f3efe6", "#f6e3d3", "#f6d8c6"];
const EYES = [
  ["M18 21 L27 18", "M46 21 L37 18", "dots"],
  ["M19 29 h8", "M37 29 h8"],
  ["dots"],
  ["dots"],
  ["M19 30 q4 -5 8 0", "M37 30 q4 -5 8 0"],
];
const MOUTH = ["M22 47 Q32 38 42 47", "M24 46 Q32 42 40 46", "M24 44 h16", "M22 41 Q32 50 42 41", "M20 39 Q32 55 44 39 Z"];

export default defineComponent({
  name: "MoodFace",
  props: { level: { type: Number, default: null } },
  setup(props) {
    return () => {
      const i = (props.level || 3) - 1;
      const line = { fill: "none", stroke: "#3b2f3f", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };
      const eyes = EYES[i].flatMap((d) =>
        d === "dots"
          ? [h("circle", { cx: 23, cy: 29, r: 2.4, fill: "#3b2f3f" }), h("circle", { cx: 41, cy: 29, r: 2.4, fill: "#3b2f3f" })]
          : [h("path", { ...line, d })],
      );
      return h(
        "svg",
        { class: ["pic-face", { "is-faded": !props.level }], viewBox: "0 0 64 64", "aria-hidden": "true", focusable: "false" },
        [
          h("circle", { cx: 32, cy: 32, r: 28, fill: FILL[i], stroke: "#3b2f3f", "stroke-width": 1.5 }),
          ...eyes,
          i === 0 ? h("path", { d: "M20 34 q-2.5 4 0 5.5 q2.5 -1.5 0 -5.5 z", fill: "#5c7a9e" }) : null,
          i === 4 ? h("circle", { cx: 16, cy: 38, r: 4, fill: "#e3a584", opacity: 0.5 }) : null,
          i === 4 ? h("circle", { cx: 48, cy: 38, r: 4, fill: "#e3a584", opacity: 0.5 }) : null,
          h("path", { ...line, d: MOUTH[i], fill: i === 4 ? "#3b2f3f" : "none" }),
        ],
      );
    };
  },
});
