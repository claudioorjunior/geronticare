CREATE TABLE "cargos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"permissoes" jsonb NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cargos_instituicao_nome_unique" UNIQUE("instituicao_id","nome")
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "cargo_id" uuid;--> statement-breakpoint
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_instituicao_id_instituicoes_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cargo_id_cargos_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id") ON DELETE no action ON UPDATE no action;