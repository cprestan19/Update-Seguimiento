import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0E14",
        panel: "#11161F",
        panel2: "#161C27",
        border: "#212B39",
        text: "#E6EDF3",
        muted: "#7C8A9C",
        muted2: "#4E5A6B",
        teal: "#2DD4BF",
        tealDim: "#123832",
        amber: "#F5A623",
        amberDim: "#3A2C0F",
        blue: "#3B9EFF",
        blueDim: "#0F2438",
        red: "#F2495C",
        redDim: "#3A1218",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
