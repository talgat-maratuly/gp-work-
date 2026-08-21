import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductSyncAndNullableMovements1730500000000 implements MigrationInterface {
  name = 'ProductSyncAndNullableMovements1730500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN "is_actual" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      DROP CONSTRAINT "FK_stock_movements_product"
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      ALTER COLUMN "product_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      ADD CONSTRAINT "FK_stock_movements_product" FOREIGN KEY ("product_id")
        REFERENCES "products"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      DROP CONSTRAINT "FK_stock_movements_product"
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      ALTER COLUMN "product_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      ADD CONSTRAINT "FK_stock_movements_product" FOREIGN KEY ("product_id")
        REFERENCES "products"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN "is_actual"
    `);
  }
}
