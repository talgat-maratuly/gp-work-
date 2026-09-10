import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOperationalResources1731500000000 implements MigrationInterface {
  name = 'AddOperationalResources1731500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN "reserved_quantity" numeric(14,3) NOT NULL DEFAULT 0,
        ADD COLUMN "minimum_quantity" numeric(14,3) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
        ADD COLUMN "task_id" integer,
        ADD COLUMN "brigade_id" integer,
        ADD COLUMN "employee_id" integer,
        ADD COLUMN "route_id" integer,
        ADD COLUMN "execution_id" integer,
        ADD COLUMN "client_operation_id" uuid,
        ADD CONSTRAINT "UQ_stock_movements_client_operation" UNIQUE ("client_operation_id"),
        ADD CONSTRAINT "FK_stock_movements_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_stock_movements_brigade" FOREIGN KEY ("brigade_id") REFERENCES "brigades"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_stock_movements_employee" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_stock_movements_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_stock_movements_execution" FOREIGN KEY ("execution_id") REFERENCES "work_executions"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_stock_movements_task" ON "stock_movements" ("task_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_stock_movements_execution" ON "stock_movements" ("execution_id")`);

    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id" SERIAL NOT NULL,
        "code" character varying(64) NOT NULL,
        "name" character varying(160) NOT NULL,
        "type" character varying(32) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'FREE',
        "registration_number" character varying(64),
        "responsible_user_id" integer,
        "odometer" numeric(14,1),
        "engine_hours" numeric(14,1),
        "comment" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vehicles_code" UNIQUE ("code"),
        CONSTRAINT "FK_vehicles_responsible_user" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_vehicles_status" ON "vehicles" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "vehicle_assignments" (
        "id" SERIAL NOT NULL,
        "vehicle_id" integer NOT NULL,
        "brigade_id" integer,
        "route_id" integer,
        "task_id" integer,
        "execution_id" integer,
        "status" character varying(24) NOT NULL DEFAULT 'ASSIGNED',
        "assigned_by_id" integer,
        "starts_at" TIMESTAMPTZ NOT NULL,
        "ends_at" TIMESTAMPTZ,
        "start_meter" numeric(14,1),
        "end_meter" numeric(14,1),
        "comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicle_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vehicle_assignments_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_vehicle_assignments_brigade" FOREIGN KEY ("brigade_id") REFERENCES "brigades"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_vehicle_assignments_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_vehicle_assignments_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_vehicle_assignments_execution" FOREIGN KEY ("execution_id") REFERENCES "work_executions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_vehicle_assignments_assigned_by" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_vehicle_assignments_vehicle_time" ON "vehicle_assignments" ("vehicle_id", "starts_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicle_assignments_route" ON "vehicle_assignments" ("route_id")`);

    await queryRunner.query(`
      CREATE TABLE "nursery_batches" (
        "id" SERIAL NOT NULL,
        "batch_code" character varying(80) NOT NULL,
        "culture" character varying(160) NOT NULL,
        "variety" character varying(160),
        "quantity" numeric(14,3) NOT NULL,
        "reserved_quantity" numeric(14,3) NOT NULL DEFAULT 0,
        "unit" character varying(32) NOT NULL DEFAULT 'шт',
        "size" character varying(80),
        "age_months" integer,
        "location" character varying(180),
        "condition" character varying(160),
        "status" character varying(24) NOT NULL DEFAULT 'AVAILABLE',
        "received_at" date,
        "comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nursery_batches" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_nursery_batches_code" UNIQUE ("batch_code")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_nursery_batches_culture" ON "nursery_batches" ("culture")`);

    await queryRunner.query(`
      CREATE TABLE "nursery_movements" (
        "id" SERIAL NOT NULL,
        "batch_id" integer NOT NULL,
        "type" character varying(24) NOT NULL,
        "quantity" numeric(14,3) NOT NULL,
        "balance_after" numeric(14,3) NOT NULL,
        "from_location" character varying(180),
        "to_location" character varying(180),
        "object_id" integer,
        "task_id" integer,
        "brigade_id" integer,
        "employee_id" integer,
        "route_id" integer,
        "execution_id" integer,
        "created_by_id" integer,
        "client_operation_id" uuid,
        "comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nursery_movements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_nursery_movements_client_operation" UNIQUE ("client_operation_id"),
        CONSTRAINT "FK_nursery_movements_batch" FOREIGN KEY ("batch_id") REFERENCES "nursery_batches"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_nursery_movements_object" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_nursery_movements_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_nursery_movements_brigade" FOREIGN KEY ("brigade_id") REFERENCES "brigades"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_nursery_movements_employee" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_nursery_movements_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_nursery_movements_execution" FOREIGN KEY ("execution_id") REFERENCES "work_executions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_nursery_movements_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_nursery_movements_batch_time" ON "nursery_movements" ("batch_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_nursery_movements_execution" ON "nursery_movements" ("execution_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "nursery_movements"`);
    await queryRunner.query(`DROP TABLE "nursery_batches"`);
    await queryRunner.query(`DROP TABLE "vehicle_assignments"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP INDEX "IDX_stock_movements_execution"`);
    await queryRunner.query(`DROP INDEX "IDX_stock_movements_task"`);
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
        DROP CONSTRAINT "FK_stock_movements_execution",
        DROP CONSTRAINT "FK_stock_movements_route",
        DROP CONSTRAINT "FK_stock_movements_employee",
        DROP CONSTRAINT "FK_stock_movements_brigade",
        DROP CONSTRAINT "FK_stock_movements_task",
        DROP CONSTRAINT "UQ_stock_movements_client_operation",
        DROP COLUMN "client_operation_id",
        DROP COLUMN "execution_id",
        DROP COLUMN "route_id",
        DROP COLUMN "employee_id",
        DROP COLUMN "brigade_id",
        DROP COLUMN "task_id"
    `);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "minimum_quantity", DROP COLUMN "reserved_quantity"`);
  }
}
