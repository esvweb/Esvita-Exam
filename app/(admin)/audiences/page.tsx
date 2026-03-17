import { redirect } from 'next/navigation';

// Audience management has been merged into User Management
export default function AudiencesRedirect() {
  redirect('/users');
}
