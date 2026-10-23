// Datenbankschema (docs/architektur/datenmodell.md, ADR 001, ADR 002).
// Tabellen- und Spaltennamen in snake_case, Aufzählungswerte als Text in Großbuchstaben.
import { sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const ROLLEN = ["MITGLIED", "BIBLIOTHEKAR", "ADMINISTRATOR"] as const;
export type Rolle = (typeof ROLLEN)[number];

// E02-US02-FR02, OF-D3: genau diese drei Zustände
export const ZUSTAENDE = ["GUT", "BESCHAEDIGT", "VERLOREN"] as const;
export type Zustand = (typeof ZUSTAENDE)[number];

export const VORMERKUNG_STATUS = ["WARTEND", "ABHOLBEREIT", "ABGEHOLT", "ABGELAUFEN"] as const;
export type VormerkungStatus = (typeof VORMERKUNG_STATUS)[number];

export const BENACHRICHTIGUNG_TYPEN = ["ERINNERUNG", "MAHNUNG", "ABHOLBEREIT"] as const;

export const JOBS = ["FRISTPRUEFUNG", "ABHOLFRISTEN"] as const;

const zeitstempel = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const kalenderdatum = (name: string) => date(name, { mode: "string" });

function inListe(spalte: string, werte: readonly string[]) {
  return sql.raw(`${spalte} IN (${werte.map((w) => `'${w}'`).join(", ")})`);
}

// E02-US02-FR01, OF-D6: fortlaufende Nummer für INV-000001 …
export const inventarnummern = pgSequence("inventory_number_seq", { startWith: 1, increment: 1 });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<Rolle>().notNull(),
    createdAt: zeitstempel("created_at").notNull().defaultNow(),
  },
  () => [check("users_role_check", inListe("role", ROLLEN))],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: zeitstempel("expires_at").notNull(),
    createdAt: zeitstempel("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const titles = pgTable("titles", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  category: text("category").notNull(),
  isbn: text("isbn"),
  description: text("description"),
  publicationYear: integer("publication_year"),
  archivedAt: zeitstempel("archived_at"),
  createdAt: zeitstempel("created_at").notNull().defaultNow(),
  updatedAt: zeitstempel("updated_at").notNull().defaultNow(),
});

export const copies = pgTable(
  "copies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id),
    inventoryNumber: text("inventory_number").notNull().unique(),
    condition: text("condition").$type<Zustand>().notNull().default("GUT"),
    createdAt: zeitstempel("created_at").notNull().defaultNow(),
  },
  (t) => [index("copies_title_id_idx").on(t.titleId), check("copies_condition_check", inListe("condition", ZUSTAENDE))],
);

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    copyId: uuid("copy_id")
      .notNull()
      .references(() => copies.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => users.id),
    startDate: kalenderdatum("start_date").notNull(),
    dueDate: kalenderdatum("due_date").notNull(),
    renewalCount: integer("renewal_count").notNull().default(0),
    returnedAt: zeitstempel("returned_at"),
    overdueSince: kalenderdatum("overdue_since"),
    createdAt: zeitstempel("created_at").notNull().defaultNow(),
  },
  (t) => [
    // NFR06, ADR 002: höchstens ein offener Ausleihvorgang je Exemplar
    uniqueIndex("loans_one_open_per_copy").on(t.copyId).where(sql`returned_at IS NULL`),
    index("loans_member_id_idx").on(t.memberId),
    check("loans_renewal_count_check", sql`renewal_count >= 0`),
  ],
);

export const dunnings = pgTable("dunnings", {
  id: uuid("id").primaryKey().defaultRandom(),
  // E04-US02-FR01, NFR04: höchstens eine Mahnung je Ausleihvorgang
  loanId: uuid("loan_id")
    .notNull()
    .unique()
    .references(() => loans.id),
  createdOn: kalenderdatum("created_on").notNull(),
  feeCents: integer("fee_cents"),
  settledAt: zeitstempel("settled_at"),
  settledById: uuid("settled_by_id").references(() => users.id),
});

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => users.id),
    createdAt: zeitstempel("created_at").notNull().defaultNow(),
    status: text("status").$type<VormerkungStatus>().notNull(),
    copyId: uuid("copy_id").references(() => copies.id),
    pickupDeadline: kalenderdatum("pickup_deadline"),
  },
  (t) => [
    index("reservations_title_id_idx").on(t.titleId, t.status, t.createdAt),
    index("reservations_copy_id_idx").on(t.copyId),
    check("reservations_status_check", inListe("status", VORMERKUNG_STATUS)),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").$type<(typeof BENACHRICHTIGUNG_TYPEN)[number]>().notNull(),
    loanId: uuid("loan_id").references(() => loans.id),
    reservationId: uuid("reservation_id").references(() => reservations.id),
    dueDate: kalenderdatum("due_date"),
    createdAt: zeitstempel("created_at").notNull().defaultNow(),
    readAt: zeitstempel("read_at"),
  },
  (t) => [
    index("notifications_user_id_idx").on(t.userId),
    check("notifications_type_check", inListe("type", BENACHRICHTIGUNG_TYPEN)),
  ],
);

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: doublePrecision("value").notNull(),
  updatedAt: zeitstempel("updated_at").notNull().defaultNow(),
  updatedById: uuid("updated_by_id")
    .notNull()
    .references(() => users.id),
});

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: text("job").$type<(typeof JOBS)[number]>().notNull(),
    stichtag: kalenderdatum("stichtag").notNull(),
    startedAt: zeitstempel("started_at").notNull().defaultNow(),
    finishedAt: zeitstempel("finished_at"),
    ergebnis: jsonb("ergebnis"),
  },
  () => [check("job_runs_job_check", inListe("job", JOBS))],
);
