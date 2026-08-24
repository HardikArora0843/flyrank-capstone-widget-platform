import bcrypt from 'bcryptjs';
import { pool, getClient, initDb } from '../src/db/pool.js';

async function seed() {
  await initDb();
  const client = await getClient();
  try {
    console.log('--- Seeding Demo Database Data ---');

    // Clean existing test data or insert idempotently
    const existingTenant = await client.query("SELECT id FROM tenants WHERE name = 'Acme Corp' LIMIT 1");
    let tenantId;
    let userId;

    if (existingTenant.rows.length > 0) {
      tenantId = existingTenant.rows[0].id;
      const userRes = await client.query('SELECT id FROM users WHERE email = $1', ['admin@acme.com']);
      userId = userRes.rows[0]?.id;
      console.log(`Tenant 'Acme Corp' already exists (${tenantId}).`);
    } else {
      const tenantRes = await client.query(
        "INSERT INTO tenants (name) VALUES ('Acme Corp') RETURNING id"
      );
      tenantId = tenantRes.rows[0].id;
      console.log(`Created Tenant: Acme Corp (${tenantId})`);

      const passwordHash = await bcrypt.hash('password123', 10);
      const userRes = await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, name)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [tenantId, 'admin@acme.com', passwordHash, 'Acme Admin']
      );
      userId = userRes.rows[0].id;
      console.log(`Created User: admin@acme.com / password123 (${userId})`);
    }

    // Demo widgets
    const existingWidget = await client.query(
      'SELECT id FROM widgets WHERE tenant_id = $1 AND name = $2 LIMIT 1',
      [tenantId, 'Newsletter Signup']
    );

    let widgetId;
    if (existingWidget.rows.length > 0) {
      widgetId = existingWidget.rows[0].id;
      console.log(`Widget 'Newsletter Signup' already exists (${widgetId}).`);
    } else {
      const widgetRes = await client.query(
        `INSERT INTO widgets (
          tenant_id, name, type, title, description, button_text, fields, allowed_origins, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          tenantId,
          'Newsletter Signup',
          'signup',
          'Subscribe to our Product Newsletter',
          'Get the latest developer updates and platform releases delivered weekly.',
          'Subscribe Now',
          JSON.stringify([
            { name: 'name', label: 'Full Name', type: 'text', required: true },
            { name: 'email', label: 'Work Email', type: 'email', required: true }
          ]),
          ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', '*'],
          true
        ]
      );
      widgetId = widgetRes.rows[0].id;
      console.log(`Created Widget: 'Newsletter Signup' (${widgetId})`);

      // Seed a few demo submissions for rich dashboard views
      const demoSubmissions = [
        {
          data: { name: 'Alice Smith', email: 'alice@example.com' },
          ip: '24.48.0.1',
          country: 'Canada',
          country_code: 'CA',
          city: 'Montreal',
          region: 'Quebec',
          provider: 'ip-api'
        },
        {
          data: { name: 'Bob Jones', email: 'bob@example.com' },
          ip: '8.8.8.8',
          country: 'United States',
          country_code: 'US',
          city: 'Ashburn',
          region: 'Virginia',
          provider: 'ip-api'
        },
        {
          data: { name: 'Carlos Ruiz', email: 'carlos@example.com' },
          ip: '185.199.108.153',
          country: 'United Kingdom',
          country_code: 'GB',
          city: 'London',
          region: 'England',
          provider: 'ipapi.co'
        }
      ];

      for (const sub of demoSubmissions) {
        await client.query(
          `INSERT INTO submissions (
            tenant_id, widget_id, data, ip_address, user_agent, origin,
            geo_country, geo_country_code, geo_city, geo_region, geo_provider
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            tenantId,
            widgetId,
            JSON.stringify(sub.data),
            sub.ip,
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'http://localhost:5500',
            sub.country,
            sub.country_code,
            sub.city,
            sub.region,
            sub.provider
          ]
        );
      }
      console.log(`Seeded ${demoSubmissions.length} demo submissions.`);
    }

    // Also seed a second tenant for tenant isolation verification
    const existingTenantB = await client.query("SELECT id FROM tenants WHERE name = 'Beta Industries' LIMIT 1");
    if (existingTenantB.rows.length === 0) {
      const tenantBRes = await client.query("INSERT INTO tenants (name) VALUES ('Beta Industries') RETURNING id");
      const tenantBId = tenantBRes.rows[0].id;
      const passB = await bcrypt.hash('password123', 10);
      await client.query(
        "INSERT INTO users (tenant_id, email, password_hash, name) VALUES ($1, $2, $3, $4)",
        [tenantBId, 'owner@beta.com', passB, 'Beta Owner']
      );
      await client.query(
        `INSERT INTO widgets (
          tenant_id, name, type, title, description, button_text, fields, allowed_origins, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          tenantBId,
          'Beta Contact Form',
          'signup',
          'Contact Beta Industries',
          'Get in touch with our enterprise sales reps.',
          'Send Inquiry',
          JSON.stringify([{ name: 'email', label: 'Email', type: 'email', required: true }]),
          ['*'],
          true
        ]
      );
      console.log(`Created Second Tenant 'Beta Industries' for isolation tests.`);
    }

    console.log('✓ Seeding completed successfully!');
    console.log(`\nDemo Credentials:`);
    console.log(`- Email: admin@acme.com`);
    console.log(`- Password: password123`);
    console.log(`- Widget ID: ${widgetId}`);
    console.log(`- Snippet: <script src="http://localhost:3000/widget.v1.js?id=${widgetId}"></script>\n`);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
