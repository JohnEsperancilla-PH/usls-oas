import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "USLS Online Appointment System",
    short_name: "USLS OAS",
    description:
      "Schedule your campus appointments online at University of St. La Salle. Quick, easy, and secure — no account required.",
    start_url: "/",
    display: "standalone",
    background_color: "#006633",
    theme_color: "#006633",
    icons: [{ src: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  };
}