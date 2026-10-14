/** A small, finite, non-interactive burst; CSS disables it for reduced motion. */
export function Celebration({ completed = false }: { completed?: boolean }) {
  return (
    <div className={`k-celebration${completed ? " k-celebration-complete" : ""}`} aria-hidden="true">
      {["⭐", "🎈", "✨", "🌹", "⭐", "🎉"].map((symbol, index) => (
        <span key={index}>{symbol}</span>
      ))}
    </div>
  );
}