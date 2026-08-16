// Runs before any module loads, so PrismaService picks this up instead of
// falling back to the developer's dev.db — which the flight suite truncates.
process.env.DATABASE_URL = 'file:./test.db';
