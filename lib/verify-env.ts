/**
 * Verify environment variables are properly configured
 * This helps debug why API key might not be detected
 */

export function verifyEnvironmentVariables(): {
  groqKey: boolean;
  databaseUrl: boolean;
  allConfigured: boolean;
  message: string;
} {
  const groqKey = !!process.env.NEXT_PUBLIC_GROQ_API_KEY && process.env.NEXT_PUBLIC_GROQ_API_KEY.length > 0;
  const databaseUrl = !!(process.env.DATABASE_URL || process.env.NEXT_PUBLIC_NEON_CONNECTION_STRING);
  const allConfigured = groqKey && databaseUrl;

  let message = '';
  const missing: string[] = [];

  if (!groqKey) missing.push('NEXT_PUBLIC_GROQ_API_KEY atau GROQ_API_KEY');
  if (!databaseUrl) missing.push('DATABASE_URL atau NEXT_PUBLIC_NEON_CONNECTION_STRING');

  if (missing.length > 0) {
    message = `Missing environment variables: ${missing.join(', ')}. `;
    message += 'Please add them to .env.local file and restart the dev server.';
  } else {
    message = 'All environment variables are configured ✓';
  }

  return {
    groqKey,
    databaseUrl,
    allConfigured,
    message,
  };
}
