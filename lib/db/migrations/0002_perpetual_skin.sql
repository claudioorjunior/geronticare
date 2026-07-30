ALTER TABLE "pacientes" DROP CONSTRAINT "pacientes_cpf_unique";--> statement-breakpoint
ALTER TABLE "sinais_vitais" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "image" text;--> statement-breakpoint
CREATE INDEX "avaliacoes_paciente_idx" ON "avaliacoes_geriatricas" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "avaliacoes_profissional_idx" ON "avaliacoes_geriatricas" USING btree ("profissional_id");--> statement-breakpoint
CREATE INDEX "pacientes_instituicao_idx" ON "pacientes" USING btree ("instituicao_id");--> statement-breakpoint
CREATE INDEX "pacientes_ativo_idx" ON "pacientes" USING btree ("ativo");--> statement-breakpoint
CREATE INDEX "registros_paciente_idx" ON "registros" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "registros_profissional_idx" ON "registros" USING btree ("profissional_id");--> statement-breakpoint
CREATE INDEX "sinaisvitais_paciente_idx" ON "sinais_vitais" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "sinaisvitais_profissional_idx" ON "sinais_vitais" USING btree ("profissional_id");--> statement-breakpoint
CREATE INDEX "usuarios_instituicao_idx" ON "usuarios" USING btree ("instituicao_id");