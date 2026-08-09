CREATE TABLE "anexos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"paciente_id" uuid NOT NULL,
	"registro_id" uuid NOT NULL,
	"chave" text NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "anexos_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_instituicao_id_instituicoes_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_registro_id_registros_id_fk" FOREIGN KEY ("registro_id") REFERENCES "public"."registros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anexos_paciente_idx" ON "anexos" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "anexos_registro_idx" ON "anexos" USING btree ("registro_id");