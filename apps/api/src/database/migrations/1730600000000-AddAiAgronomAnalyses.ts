import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiAgronomAnalyses1730600000000 implements MigrationInterface {
  name = 'AddAiAgronomAnalyses1730600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_agronom_analyses" (
        "id" SERIAL NOT NULL,
        "created_by_id" integer,
        "object_id" integer NOT NULL,
        "section_id" integer,
        "culture" character varying,
        "photo_url" text NOT NULL,
        "status" character varying(32) NOT NULL,
        "confidence" integer NOT NULL,
        "ai_comment" text NOT NULL,
        "recommendations" text NOT NULL DEFAULT '[]',
        "agronomist_comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_agronom_analyses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_agronom_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ai_agronom_object" FOREIGN KEY ("object_id")
          REFERENCES "objects"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_ai_agronom_section" FOREIGN KEY ("section_id")
          REFERENCES "sections"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_agronom_created_at" ON "ai_agronom_analyses" ("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_agronom_status" ON "ai_agronom_analyses" ("status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_agronom_analyses"`);
  }
}
