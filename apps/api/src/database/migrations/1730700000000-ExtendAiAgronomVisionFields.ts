import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendAiAgronomVisionFields1730700000000 implements MigrationInterface {
  name = 'ExtendAiAgronomVisionFields1730700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_agronom_analyses"
      ADD COLUMN "health_percent" integer NOT NULL DEFAULT 0,
      ADD COLUMN "drought_signs" boolean NOT NULL DEFAULT false,
      ADD COLUMN "burn_signs" boolean NOT NULL DEFAULT false,
      ADD COLUMN "weeds_present" boolean NOT NULL DEFAULT false,
      ADD COLUMN "disease_signs" boolean NOT NULL DEFAULT false,
      ADD COLUMN "pest_signs" boolean NOT NULL DEFAULT false,
      ADD COLUMN "yellowing_leaves" boolean NOT NULL DEFAULT false,
      ADD COLUMN "nutrition_deficiency" boolean NOT NULL DEFAULT false,
      ADD COLUMN "mechanical_damage" boolean NOT NULL DEFAULT false,
      ADD COLUMN "fire_damage" boolean NOT NULL DEFAULT false,
      ADD COLUMN "severe_drying" boolean NOT NULL DEFAULT false,
      ADD COLUMN "mass_die_off" boolean NOT NULL DEFAULT false,
      ADD COLUMN "growth_stage" character varying,
      ADD COLUMN "model_name" character varying,
      ADD COLUMN "raw_model_response" text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_agronom_analyses"
      DROP COLUMN "raw_model_response",
      DROP COLUMN "model_name",
      DROP COLUMN "growth_stage",
      DROP COLUMN "mass_die_off",
      DROP COLUMN "severe_drying",
      DROP COLUMN "fire_damage",
      DROP COLUMN "mechanical_damage",
      DROP COLUMN "nutrition_deficiency",
      DROP COLUMN "yellowing_leaves",
      DROP COLUMN "pest_signs",
      DROP COLUMN "disease_signs",
      DROP COLUMN "weeds_present",
      DROP COLUMN "burn_signs",
      DROP COLUMN "drought_signs",
      DROP COLUMN "health_percent"
    `);
  }
}
