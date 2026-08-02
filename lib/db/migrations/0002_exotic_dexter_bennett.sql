CREATE TABLE "aplicacoes_instrumentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"instrumento" text NOT NULL,
	"profissional_id" uuid NOT NULL,
	"registrado_por_id" uuid NOT NULL,
	"data_aplicacao" timestamp NOT NULL,
	"respostas" jsonb NOT NULL,
	"escore" integer,
	"classificacao" text NOT NULL,
	"descricao_classificacao" text NOT NULL,
	"versao_instrumento" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aplicacoes_instrumentos" ADD CONSTRAINT "aplicacoes_instrumentos_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aplicacoes_instrumentos" ADD CONSTRAINT "aplicacoes_instrumentos_profissional_id_usuarios_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aplicacoes_instrumentos" ADD CONSTRAINT "aplicacoes_instrumentos_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aplicacoes_paciente_instrumento_data_idx" ON "aplicacoes_instrumentos" USING btree ("paciente_id","instrumento","data_aplicacao");--> statement-breakpoint
CREATE INDEX "aplicacoes_profissional_idx" ON "aplicacoes_instrumentos" USING btree ("profissional_id");--> statement-breakpoint
CREATE INDEX "aplicacoes_registrado_por_idx" ON "aplicacoes_instrumentos" USING btree ("registrado_por_id");