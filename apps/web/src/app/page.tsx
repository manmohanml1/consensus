import { DecisionWorkflow } from "@/components/decision-workflow";
import { connection } from "next/server";

export default async function HomePage() {
  await connection();
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="eyebrow">Consensus · decision MVP</div>
        <h1 id="hero-title">Make the choice. Keep the group.</h1>
        <p className="hero-copy">
          Non-negotiables first, preferences second, and a clear reason for the
          result. Build a room, review honest options, vote together, and leave
          with a plan—all without an account.
        </p>
        <div className="hero-meta" aria-label="Product principles">
          <span>Zero signup</span>
          <span>Constraint-aware</span>
          <span>Explainable result</span>
        </div>
      </section>

      <DecisionWorkflow />

      <section
        className="architecture-note"
        aria-labelledby="architecture-title"
      >
        <p className="section-kicker">What this proves</p>
        <h2 id="architecture-title">
          The interaction is the doorway, not the moat.
        </h2>
        <div className="principle-grid">
          <article>
            <span>01</span>
            <h3>Safe before popular</h3>
            <p>
              Unavailable or failed constraints remove a candidate before
              anyone’s enthusiasm can outweigh them.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Fair before flashy</h3>
            <p>
              The rules protect broad acceptance and the least-satisfied
              participant before total preference.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Honest before complete</h3>
            <p>
              Missing hours, price, access, or provider facts remain missing
              instead of becoming plausible fiction.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
