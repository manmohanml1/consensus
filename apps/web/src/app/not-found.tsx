import Link from "next/link";

export default function NotFound() {
  return (
    <main className="centered-message">
      <p className="section-kicker">404</p>
      <h1>This room is unavailable.</h1>
      <p>It may have expired, ended, or never existed.</p>
      <Link href="/">Return to Consensus</Link>
    </main>
  );
}
