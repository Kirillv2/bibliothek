// Migrationen (ADR 002). Jede Migration ist eine Liste einzelner SQL-Anweisungen, damit sie mit
// PGlite (Tests, lokal) und einem PostgreSQL-Treiber (gehostet) gleich ausgeführt werden kann.
// 001 wurde mit `drizzle-kit export` aus schema.ts erzeugt; Änderungen am Schema kommen als neue Migration dazu.

export type Migration = { id: string; anweisungen: string[] };

export const MIGRATIONEN: Migration[] = [
  {
    id: "001_grundschema",
    anweisungen: [
      `CREATE SEQUENCE "public"."inventory_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1`,
      `CREATE TABLE "copies" (
       	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       	"title_id" uuid NOT NULL,
       	"inventory_number" text NOT NULL,
       	"condition" text DEFAULT 'GUT' NOT NULL,
       	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
       	CONSTRAINT "copies_inventory_number_unique" UNIQUE("inventory_number"),
       	CONSTRAINT "copies_condition_check" CHECK (condition IN ('GUT', 'BESCHAEDIGT', 'VERLOREN'))
       )`,
      `CREATE TABLE "dunnings" (
       	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       	"loan_id" uuid NOT NULL,
       	"created_on" date NOT NULL,
       	"fee_cents" integer,
       	"settled_at" timestamp with time zone,
       	"settled_by_id" uuid,
       	CONSTRAINT "dunnings_loan_id_unique" UNIQUE("loan_id")
       )`,
      `CREATE TABLE "job_runs" (
       	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       	"job" text NOT NULL,
       	"stichtag" date NOT NULL,
       	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
       	"finished_at" timestamp with time zone,
       	"ergebnis" jsonb,
       	CONSTRAINT "job_runs_job_check" CHECK (job IN ('FRISTPRUEFUNG', 'ABHOLFRISTEN'))
       )`,
      `CREATE TABLE "loans" (
       	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       	"copy_id" uuid NOT NULL,
       	"member_id" uuid NOT NULL,
       	"start_date" date NOT NULL,
       	"due_date" date NOT NULL,
       	"renewal_count" integer DEFAULT 0 NOT NULL,
       	"returned_at" timestamp with time zone,
       	"overdue_since" date,
       	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
       	CONSTRAINT "loans_renewal_count_check" CHECK (renewal_count >= 0)
       )`,
      `CREATE TABLE "notifications" (
       	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       	"user_id" uuid NOT NULL,
       	"type" text NOT NULL,
       	"loan_id" uuid,
       	"reservation_id" uuid,
       	"due_date" date,
       	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
       	"read_at" timestamp with time zone,
       	CONSTRAINT "notifications_type_check" CHECK (type IN ('ERINNERUNG', 'MAHNUNG', 'ABHOLBEREIT'))
       )`,
      `CREATE TABLE "reservations" (
       	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       	"title_id" uuid NOT NULL,
       	"member_id" uuid NOT NULL,
       	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
       	"status" text NOT NULL,
       	"copy_id" uuid,
       	"pickup_deadline" date,
       	CONSTRAINT "reservations_status_check" CHECK (status IN ('WARTEND', 'ABHOLBEREIT', 'ABGEHOLT', 'ABGELAUFEN'))
       )`,
      `CREATE TABLE "sessions" (
       	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       	"user_id" uuid NOT NULL,
       	"token_hash" text NOT NULL,
       	"expires_at" timestamp with time zone NOT NULL,
       	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
       	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
       )`,
      `CREATE TABLE "system_settings" (
       	"key" text PRIMARY KEY NOT NULL,
       	"value" double precision NOT NULL,
       	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
       	"updated_by_id" uuid NOT NULL
       )`,
      `CREATE TABLE "titles" (
       	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       	"title" text NOT NULL,
       	"author" text NOT NULL,
       	"category" text NOT NULL,
       	"isbn" text,
       	"description" text,
       	"publication_year" integer,
       	"archived_at" timestamp with time zone,
       	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
       	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
       )`,
      `CREATE TABLE "users" (
       	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       	"email" text NOT NULL,
       	"password_hash" text NOT NULL,
       	"role" text NOT NULL,
       	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
       	CONSTRAINT "users_email_unique" UNIQUE("email"),
       	CONSTRAINT "users_role_check" CHECK (role IN ('MITGLIED', 'BIBLIOTHEKAR', 'ADMINISTRATOR'))
       )`,
      `ALTER TABLE "copies" ADD CONSTRAINT "copies_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "dunnings" ADD CONSTRAINT "dunnings_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "dunnings" ADD CONSTRAINT "dunnings_settled_by_id_users_id_fk" FOREIGN KEY ("settled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "loans" ADD CONSTRAINT "loans_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "loans" ADD CONSTRAINT "loans_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "reservations" ADD CONSTRAINT "reservations_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "reservations" ADD CONSTRAINT "reservations_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "reservations" ADD CONSTRAINT "reservations_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action`,
      `ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action`,
      `CREATE INDEX "copies_title_id_idx" ON "copies" USING btree ("title_id")`,
      `CREATE UNIQUE INDEX "loans_one_open_per_copy" ON "loans" USING btree ("copy_id") WHERE returned_at IS NULL`,
      `CREATE INDEX "loans_member_id_idx" ON "loans" USING btree ("member_id")`,
      `CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id")`,
      `CREATE INDEX "reservations_title_id_idx" ON "reservations" USING btree ("title_id","status","created_at")`,
      `CREATE INDEX "reservations_copy_id_idx" ON "reservations" USING btree ("copy_id")`,
      `CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id")`,
    ],
  },
];
