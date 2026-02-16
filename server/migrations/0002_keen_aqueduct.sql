CREATE TABLE "expense_split" (
	"expense_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"amount" numeric(18, 2),
	"shares" numeric(18, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_split_expense_id_participant_id_pk" PRIMARY KEY("expense_id","participant_id")
);
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "split_mode" text DEFAULT 'EQUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "occurred_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_split_expense_index" ON "expense_split" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expense_split_participant_index" ON "expense_split" USING btree ("participant_id");