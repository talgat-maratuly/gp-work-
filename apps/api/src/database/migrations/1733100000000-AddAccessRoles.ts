import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccessRoles1733100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE access_roles (
      id SERIAL PRIMARY KEY, name varchar(100) NOT NULL UNIQUE,
      base_role varchar(32) NOT NULL, system_key varchar(32) UNIQUE,
      permissions jsonb, pages jsonb NOT NULL DEFAULT '[]',
      can_join_brigade boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
      revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    const roles = [['DIRECTOR','Директор'],['ADMIN','Администратор'],['ACCOUNTANT','Бухгалтер'],
      ['BRIGADIER','Бригадир'],['AGRONOMIST','Агроном'],['WORKER','Рабочий'],
      ['WATER_CARRIER','Водовоз'],['AKIMAT','Акимат'],['ANTICOR','Антикор']];
    for (const [key, name] of roles) await q.query(
      'INSERT INTO access_roles(name, base_role, system_key, can_join_brigade) VALUES ($1,$2,$2,$3)',
      [name, key, ['BRIGADIER','AGRONOMIST','WORKER','WATER_CARRIER'].includes(key)]);
    await q.query('ALTER TABLE users ADD COLUMN access_role_id integer REFERENCES access_roles(id) ON DELETE RESTRICT');
    await q.query('CREATE INDEX idx_users_access_role ON users(access_role_id)');
    await q.query('CREATE UNIQUE INDEX idx_access_roles_name_lower ON access_roles(lower(name))');
  }
  async down(q: QueryRunner): Promise<void> {
    // Do not silently convert restricted custom accounts into unrestricted base roles.
    const assigned = await q.query('SELECT 1 FROM users WHERE access_role_id IS NOT NULL LIMIT 1');
    if (assigned.length) throw new Error('Reassign custom-role users before reverting access roles');
    await q.query('ALTER TABLE users DROP COLUMN access_role_id');
    await q.query('DROP TABLE access_roles');
  }
}
