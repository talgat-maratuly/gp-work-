import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectorPasskeys1733600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE auth_passkeys (
      id UUID PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE, public_key BYTEA NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0, auth_version INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_used_at TIMESTAMPTZ
    )`);
    await q.query('CREATE INDEX auth_passkeys_user_idx ON auth_passkeys(user_id)');
    await q.query(`CREATE TABLE auth_passkey_challenges (
      id UUID PRIMARY KEY, challenge TEXT NOT NULL, purpose VARCHAR(12) NOT NULL,
      binding TEXT NOT NULL, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      auth_version INTEGER, expires_at TIMESTAMPTZ NOT NULL
    )`);
    await q.query('CREATE INDEX auth_passkey_challenges_expiry_idx ON auth_passkey_challenges(expires_at)');
  }
  async down(): Promise<void> { throw new Error('Passkey migration is additive; restore only through an approved recovery procedure.'); }
}
