"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="centered-message">
      <p className="section-kicker">Something interrupted the room</p>
      <h1>Your action was not confirmed.</h1>
      <p>
        Try again. The product will never report an unsaved vote as successful.
      </p>
      <button type="button" className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
