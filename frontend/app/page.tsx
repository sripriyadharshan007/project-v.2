import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect root to the workflows dashboard
  redirect('/workflows');
}
