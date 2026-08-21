import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductsAndStockMovements1730400000000 implements MigrationInterface {
  name = 'AddProductsAndStockMovements1730400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" SERIAL NOT NULL,
        "code" character varying,
        "article" character varying,
        "name" character varying NOT NULL,
        "unit" character varying,
        "accounting_price" numeric(14,2) NOT NULL DEFAULT 0,
        "sale_price" numeric(14,2) NOT NULL DEFAULT 0,
        "our_price" numeric(14,2) NOT NULL DEFAULT 0,
        "markup_percent" numeric(8,2),
        "initial_quantity" numeric(14,3) NOT NULL DEFAULT 0,
        "incoming_quantity" numeric(14,3) NOT NULL DEFAULT 0,
        "outgoing_quantity" numeric(14,3) NOT NULL DEFAULT 0,
        "current_quantity" numeric(14,3) NOT NULL DEFAULT 0,
        "total_amount" numeric(14,2) NOT NULL DEFAULT 0,
        "external_id_1c" character varying,
        "code_1c" character varying,
        "source" character varying(16) NOT NULL DEFAULT 'MANUAL',
        "last_sync_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_products_code_unique" ON "products" ("code") WHERE "code" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_products_article_unique" ON "products" ("article") WHERE "article" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" SERIAL NOT NULL,
        "product_id" integer NOT NULL,
        "type" character varying(32) NOT NULL,
        "quantity" numeric(14,3) NOT NULL,
        "created_by_id" integer,
        "worker_name" character varying,
        "object_id" integer,
        "section_id" integer,
        "purpose" text,
        "comment" text,
        "balance_after" numeric(14,3) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_movements_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stock_movements_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_stock_movements_object" FOREIGN KEY ("object_id")
          REFERENCES "objects"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_stock_movements_section" FOREIGN KEY ("section_id")
          REFERENCES "sections"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_stock_movements_product_id" ON "stock_movements" ("product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_stock_movements_created_at" ON "stock_movements" ("created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
