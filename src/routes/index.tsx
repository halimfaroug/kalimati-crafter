import { createFileRoute } from "@tanstack/react-router";
import KalimatiApp from "@/features/kalimati/KalimatiApp";

const title = "Kalimati wa Arghami — My Words and My Numbers";
const description =
  "Learn Arabic words and numbers with picture books, counting games, sentence practice, spoken words, stickers and streaks in Kalimati wa Arghami.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KalimatiApp,
});
