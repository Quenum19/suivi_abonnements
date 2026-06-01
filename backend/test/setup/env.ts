// Définit l'environnement de test AVANT le chargement des modules (env.ts, db.ts).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.SCHEDULER_ENABLED = 'false';
process.env.APP_PASSWORD = '';
process.env.REMINDER_THRESHOLDS = '30,7,1';
process.env.N8N_ENABLED = 'true';
process.env.N8N_WEBHOOK_URL = 'http://localhost:9999/webhook-test';
process.env.EMAIL_ENABLED = 'false';
