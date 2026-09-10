import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFieldExecutionCore1731400000000 implements MigrationInterface {
  name = 'AddFieldExecutionCore1731400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "routes" (
        "id" SERIAL NOT NULL,
        "work_date" date NOT NULL,
        "brigade_id" integer NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'PLANNED',
        "started_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "comment" text,
        "created_by_id" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_routes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_routes_brigade" FOREIGN KEY ("brigade_id") REFERENCES "brigades"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_routes_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_routes_work_date" ON "routes" ("work_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_routes_brigade" ON "routes" ("brigade_id")`);

    await queryRunner.query(`
      CREATE TABLE "route_stops" (
        "id" SERIAL NOT NULL,
        "route_id" integer NOT NULL,
        "task_id" integer NOT NULL,
        "section_id" integer NOT NULL,
        "position" integer NOT NULL,
        "planned_arrival_at" TIMESTAMPTZ,
        "status" character varying(24) NOT NULL DEFAULT 'PLANNED',
        "arrived_at" TIMESTAMPTZ,
        "arrival_latitude" double precision,
        "arrival_longitude" double precision,
        "arrival_accuracy" double precision,
        "distance_meters" double precision,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_route_stops" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_route_stop_position" UNIQUE ("route_id", "position"),
        CONSTRAINT "FK_route_stops_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_route_stops_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_route_stops_section" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_route_stops_route" ON "route_stops" ("route_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_route_stops_task" ON "route_stops" ("task_id")`);

    await queryRunner.query(`
      CREATE TABLE "work_executions" (
        "id" SERIAL NOT NULL,
        "client_execution_id" uuid NOT NULL,
        "task_id" integer NOT NULL,
        "section_id" integer NOT NULL,
        "worker_user_id" integer NOT NULL,
        "brigade_id" integer,
        "route_stop_id" integer,
        "status" character varying(24) NOT NULL DEFAULT 'ASSIGNED',
        "qr_verified_at" TIMESTAMPTZ,
        "arrived_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "accepted_at" TIMESTAMPTZ,
        "accepted_by_id" integer,
        "arrival_latitude" double precision,
        "arrival_longitude" double precision,
        "arrival_accuracy" double precision,
        "arrival_distance_meters" double precision,
        "comment" text,
        "review_comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_executions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_executions_client" UNIQUE ("client_execution_id"),
        CONSTRAINT "UQ_work_executions_task" UNIQUE ("task_id"),
        CONSTRAINT "UQ_work_executions_route_stop" UNIQUE ("route_stop_id"),
        CONSTRAINT "FK_work_executions_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_work_executions_section" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_work_executions_worker" FOREIGN KEY ("worker_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_work_executions_brigade" FOREIGN KEY ("brigade_id") REFERENCES "brigades"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_work_executions_route_stop" FOREIGN KEY ("route_stop_id") REFERENCES "route_stops"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_work_executions_accepted_by" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_work_executions_task" ON "work_executions" ("task_id")`);

    await queryRunner.query(`
      CREATE TABLE "work_execution_events" (
        "id" SERIAL NOT NULL,
        "client_operation_id" uuid NOT NULL,
        "execution_id" integer NOT NULL,
        "actor_user_id" integer,
        "type" character varying(40) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "latitude" double precision,
        "longitude" double precision,
        "accuracy" double precision,
        "occurred_at" TIMESTAMPTZ NOT NULL,
        "received_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_execution_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_execution_events_client" UNIQUE ("client_operation_id"),
        CONSTRAINT "FK_work_execution_events_execution" FOREIGN KEY ("execution_id") REFERENCES "work_executions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_work_execution_events_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_work_execution_events_execution" ON "work_execution_events" ("execution_id")`);

    await queryRunner.query(`
      CREATE TABLE "work_photos" (
        "id" SERIAL NOT NULL,
        "client_photo_id" uuid NOT NULL,
        "execution_id" integer NOT NULL,
        "uploaded_by_id" integer,
        "phase" character varying(16) NOT NULL,
        "url" text NOT NULL,
        "content_hash" character varying(128),
        "captured_at" TIMESTAMPTZ NOT NULL,
        "latitude" double precision,
        "longitude" double precision,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_photos" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_photos_client" UNIQUE ("client_photo_id"),
        CONSTRAINT "FK_work_photos_execution" FOREIGN KEY ("execution_id") REFERENCES "work_executions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_work_photos_uploader" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_work_photos_execution_phase" ON "work_photos" ("execution_id", "phase")`);

    await queryRunner.query(`
      CREATE TABLE "checklist_items" (
        "id" SERIAL NOT NULL,
        "work_type_id" integer,
        "label" text NOT NULL,
        "is_required" boolean NOT NULL DEFAULT true,
        "position" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_checklist_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_checklist_items_work_type" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_checklist_items_work_type" ON "checklist_items" ("work_type_id")`);
    await queryRunner.query(`
      INSERT INTO "checklist_items" ("work_type_id", "label", "is_required", "position") VALUES
        (NULL, 'Проверить рабочую зону и условия безопасности', true, 10),
        (NULL, 'Выполнить работу по заданию', true, 20),
        (NULL, 'Убрать рабочую зону после выполнения', true, 30)
    `);

    await queryRunner.query(`
      CREATE TABLE "checklist_answers" (
        "id" SERIAL NOT NULL,
        "execution_id" integer NOT NULL,
        "item_id" integer NOT NULL,
        "is_completed" boolean NOT NULL DEFAULT false,
        "comment" text,
        "completed_by_id" integer,
        "completed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_checklist_answers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_checklist_answer_execution_item" UNIQUE ("execution_id", "item_id"),
        CONSTRAINT "FK_checklist_answers_execution" FOREIGN KEY ("execution_id") REFERENCES "work_executions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_checklist_answers_item" FOREIGN KEY ("item_id") REFERENCES "checklist_items"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_checklist_answers_completed_by" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_checklist_answers_execution" ON "checklist_answers" ("execution_id")`);

    await queryRunner.query(`
      CREATE TABLE "face_verifications" (
        "id" SERIAL NOT NULL,
        "client_operation_id" uuid NOT NULL,
        "execution_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'PENDING',
        "selfie_url" text NOT NULL,
        "liveness_evidence_urls" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "reviewed_by_id" integer,
        "reviewed_at" TIMESTAMPTZ,
        "review_comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_face_verifications" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_face_verifications_client" UNIQUE ("client_operation_id"),
        CONSTRAINT "FK_face_verifications_execution" FOREIGN KEY ("execution_id") REFERENCES "work_executions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_face_verifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_face_verifications_reviewer" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_face_verifications_execution" ON "face_verifications" ("execution_id")`);

    await queryRunner.query(`
      CREATE TABLE "location_events" (
        "id" SERIAL NOT NULL,
        "client_operation_id" uuid NOT NULL,
        "user_id" integer NOT NULL,
        "brigade_id" integer,
        "route_id" integer,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "accuracy" double precision,
        "recorded_at" TIMESTAMPTZ NOT NULL,
        "received_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_location_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_location_events_client" UNIQUE ("client_operation_id"),
        CONSTRAINT "FK_location_events_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_location_events_brigade" FOREIGN KEY ("brigade_id") REFERENCES "brigades"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_location_events_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_location_events_user_time" ON "location_events" ("user_id", "recorded_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_location_events_route_time" ON "location_events" ("route_id", "recorded_at")`);

    await queryRunner.query(`
      CREATE TABLE "sync_operations" (
        "id" SERIAL NOT NULL,
        "client_operation_id" uuid NOT NULL,
        "user_id" integer,
        "type" character varying(48) NOT NULL,
        "payload_hash" character varying(128) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'PROCESSING',
        "resource_type" character varying(48),
        "resource_id" character varying(64),
        "response" jsonb,
        "error_message" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sync_operations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sync_operations_client" UNIQUE ("client_operation_id"),
        CONSTRAINT "FK_sync_operations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "work_logs"
        ADD COLUMN "user_id" integer,
        ADD COLUMN "brigade_id" integer,
        ADD COLUMN "execution_id" integer,
        ADD CONSTRAINT "FK_work_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_work_logs_brigade" FOREIGN KEY ("brigade_id") REFERENCES "brigades"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_work_logs_execution" FOREIGN KEY ("execution_id") REFERENCES "work_executions"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "UQ_work_logs_execution" UNIQUE ("execution_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_logs" DROP CONSTRAINT "UQ_work_logs_execution", DROP CONSTRAINT "FK_work_logs_execution", DROP CONSTRAINT "FK_work_logs_brigade", DROP CONSTRAINT "FK_work_logs_user", DROP COLUMN "execution_id", DROP COLUMN "brigade_id", DROP COLUMN "user_id"`);
    await queryRunner.query(`DROP TABLE "sync_operations"`);
    await queryRunner.query(`DROP TABLE "location_events"`);
    await queryRunner.query(`DROP TABLE "face_verifications"`);
    await queryRunner.query(`DROP TABLE "checklist_answers"`);
    await queryRunner.query(`DROP TABLE "checklist_items"`);
    await queryRunner.query(`DROP TABLE "work_photos"`);
    await queryRunner.query(`DROP TABLE "work_execution_events"`);
    await queryRunner.query(`DROP TABLE "work_executions"`);
    await queryRunner.query(`DROP TABLE "route_stops"`);
    await queryRunner.query(`DROP TABLE "routes"`);
  }
}
