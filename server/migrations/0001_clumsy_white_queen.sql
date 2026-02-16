DROP INDEX "participant_project_name_unique";--> statement-breakpoint
ALTER TABLE "participant" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "participant_project_manual_name_unique" ON "participant" USING btree ("project_id",lower("name")) WHERE "participant"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "participant_project_user_unique" ON "participant" USING btree ("project_id","user_id");