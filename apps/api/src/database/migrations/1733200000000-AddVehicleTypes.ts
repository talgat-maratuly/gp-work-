import { MigrationInterface, QueryRunner } from 'typeorm';

// Справочник видов техники. Существующие виды переносятся как системные записи,
// их ключи совпадают с прежним enum VehicleType, поэтому вся имеющаяся техника
// (vehicles.type) и история назначений сохраняются без изменений.
export class AddVehicleTypes1733200000000 implements MigrationInterface {
  name = 'AddVehicleTypes1733200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vehicle_types" (
        "id" SERIAL PRIMARY KEY,
        "key" character varying(32) NOT NULL,
        "name" character varying(100) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vehicle_types_key" ON "vehicle_types" ("key")`,
    );

    const seed: Array<[string, string, number]> = [
      ['CAR', 'Автомобиль', 10],
      ['WATER_TRUCK', 'Водовоз', 20],
      ['MOWER', 'Газонокосилка', 30],
      ['PUMP', 'Насос', 40],
      ['GENERATOR', 'Генератор', 50],
      ['DRILLING_RIG', 'Буровая установка', 60],
      ['EQUIPMENT', 'Оборудование', 70],
    ];
    for (const [key, name, order] of seed) {
      await queryRunner.query(
        `INSERT INTO "vehicle_types" ("key", "name", "sort_order", "is_system")
         VALUES ($1, $2, $3, true)
         ON CONFLICT ("key") DO NOTHING`,
        [key, name, order],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicle_types"`);
  }
}
