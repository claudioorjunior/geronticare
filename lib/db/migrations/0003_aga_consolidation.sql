CREATE TYPE "public"."aga_status" AS ENUM('rascunho', 'concluida');--> statement-breakpoint
CREATE TABLE "aga_aplicacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aga_id" uuid NOT NULL,
	"aplicacao_instrumento_id" uuid NOT NULL,
	"instrumento" text NOT NULL,
	"profissional_id" uuid NOT NULL,
	"registrado_por_id" uuid NOT NULL,
	"data_aplicacao" timestamp NOT NULL,
	"respostas" jsonb NOT NULL,
	"escore" integer,
	"classificacao" text NOT NULL,
	"descricao_classificacao" text NOT NULL,
	"versao_instrumento" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aga_aplicacoes_aga_instrumento_unique" UNIQUE("aga_id","instrumento"),
	CONSTRAINT "aga_aplicacoes_aga_aplicacao_unique" UNIQUE("aga_id","aplicacao_instrumento_id")
);
--> statement-breakpoint
CREATE TABLE "agas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"criado_por_id" uuid NOT NULL,
	"status" "aga_status" DEFAULT 'rascunho' NOT NULL,
	"data_avaliacao" timestamp DEFAULT now() NOT NULL,
	"observacoes" text,
	"resultado" text,
	"classificacao" text,
	"descricao_classificacao" text,
	"concluida_em" timestamp,
	"concluida_por_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aga_aplicacoes" ADD CONSTRAINT "aga_aplicacoes_aga_id_agas_id_fk" FOREIGN KEY ("aga_id") REFERENCES "public"."agas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aga_aplicacoes" ADD CONSTRAINT "aga_aplicacoes_aplicacao_instrumento_id_aplicacoes_instrumentos_id_fk" FOREIGN KEY ("aplicacao_instrumento_id") REFERENCES "public"."aplicacoes_instrumentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aga_aplicacoes" ADD CONSTRAINT "aga_aplicacoes_profissional_id_usuarios_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aga_aplicacoes" ADD CONSTRAINT "aga_aplicacoes_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agas" ADD CONSTRAINT "agas_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agas" ADD CONSTRAINT "agas_criado_por_id_usuarios_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agas" ADD CONSTRAINT "agas_concluida_por_id_usuarios_id_fk" FOREIGN KEY ("concluida_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aga_aplicacoes_aga_idx" ON "aga_aplicacoes" USING btree ("aga_id");--> statement-breakpoint
CREATE INDEX "agas_paciente_idx" ON "agas" USING btree ("paciente_id");