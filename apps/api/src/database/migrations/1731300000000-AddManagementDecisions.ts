import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManagementDecisions1731300000000 implements MigrationInterface {
  name = 'AddManagementDecisions1731300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "management_decisions" (
        "id" SERIAL NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "responsible_user_id" integer,
        "due_date" date,
        "priority" character varying(16) NOT NULL DEFAULT 'MEDIUM',
        "status" character varying(24) NOT NULL DEFAULT 'OPEN',
        "comment" text,
        "linked_task_id" integer,
        "status_history" text NOT NULL DEFAULT '[]',
        "created_by_id" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_management_decisions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_decisions_due_date" ON "management_decisions" ("due_date")`,
    );

    await queryRunner.query(`
      ALTER TABLE "management_decisions"
        ADD CONSTRAINT "FK_decision_responsible" FOREIGN KEY ("responsible_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_decision_linked_task" FOREIGN KEY ("linked_task_id")
          REFERENCES "tasks"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_decision_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "management_decisions"`);
  }
}
