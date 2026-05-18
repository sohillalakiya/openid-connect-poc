export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initialize } = await import('./lib/db');
    await initialize();
  }
}
