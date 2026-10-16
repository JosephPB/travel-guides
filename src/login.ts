// Reserved example domain: an internal Auth identifier, never an email destination.
export function usernameEmail(username: string): string {
 const normalized = username.trim().toLowerCase();
 if (!/^[a-z0-9][a-z0-9._-]{0,39}$/.test(normalized)) {
  throw new Error('Use a username of 1–40 letters, numbers, dots, hyphens or underscores, starting with a letter or number.');
 }
 return `${normalized}@never-lonely.example.com`;
}
