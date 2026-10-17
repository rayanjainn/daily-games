import { BRAND } from '@everydaily/shared';

export default function Home() {
  return (
    <main>
      <h1>{BRAND.name}</h1>
      <p>{BRAND.tagline}</p>
    </main>
  );
}
