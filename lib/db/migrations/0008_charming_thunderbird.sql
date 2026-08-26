DROP INDEX "agas_paciente_idx";--> statement-breakpoint
DROP INDEX "pacientes_ativo_idx";--> statement-breakpoint
DROP INDEX "registros_paciente_idx";--> statement-breakpoint
DROP INDEX "sinaisvitais_paciente_idx";--> statement-breakpoint
ALTER TABLE "instituicoes" ADD COLUMN "dashboard_layout" jsonb;--> statement-breakpoint
CREATE INDEX "agas_paciente_status_idx" ON "agas" USING btree ("paciente_id","status");--> statement-breakpoint
CREATE INDEX "agas_paciente_concluida_idx" ON "agas" USING btree ("paciente_id","concluida_em");--> statement-breakpoint
CREATE INDEX "pacientes_instituicao_ativo_idx" ON "pacientes" USING btree ("instituicao_id","ativo");--> statement-breakpoint
CREATE INDEX "pacientes_instituicao_admissao_idx" ON "pacientes" USING btree ("instituicao_id","data_admissao");--> statement-breakpoint
CREATE INDEX "registros_paciente_data_idx" ON "registros" USING btree ("paciente_id","data_registro");--> statement-breakpoint
CREATE INDEX "sinaisvitais_paciente_data_idx" ON "sinais_vitais" USING btree ("paciente_id","data_afericao");