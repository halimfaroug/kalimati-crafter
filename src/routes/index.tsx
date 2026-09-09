import { createFileRoute } from "@tanstack/react-router";
import KalimatiApp from "@/features/kalimati/KalimatiApp";

const title = "Kalimati — My Words | English–Arabic word practice";
const description =
  "A playful English–Arabic vocabulary app: 20 picture word books, flashcard practice, spoken words, starred favourites, stickers and streaks.";

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
