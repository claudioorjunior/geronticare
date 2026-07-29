CREATE TYPE "public"."especialidade" AS ENUM('medicina', 'enfermagem', 'fisioterapia', 'terapia_ocupacional', 'fonoaudiologia', 'nutricao', 'psicologia', 'servico_social');--> statement-breakpoint
CREATE TYPE "public"."estado_civil" AS ENUM('solteiro', 'casado', 'viuvo', 'divorciado', 'uniao_estavel');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'profissional', 'usuario');--> statement-breakpoint
CREATE TYPE "public"."sexo" AS ENUM('masculino', 'feminino', 'outro');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avaliacoes_geriatricas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"profissional_id" uuid NOT NULL,
	"data_avaliacao" timestamp DEFAULT now() NOT NULL,
	"katz_score" integer,
	"lawton_score" integer,
	"meem_score" integer,
	"gds15_score" integer,
	"man_score" integer,
	"tug_segundos" integer,
	"comorbidades" jsonb,
	"medicamentos" jsonb,
	"suporte_social" text,
	"moradia" text,
	"observacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instituicoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"cnpj" text,
	"telefone" text,
	"email" text,
	"endereco" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instituicoes_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "pacientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"data_nascimento" timestamp NOT NULL,
	"cpf" text,
	"rg" text,
	"sexo" "sexo" NOT NULL,
	"estado_civil" "estado_civil",
	"telefone" text,
	"email" text,
	"endereco" jsonb,
	"contato_emergencia" jsonb,
	"data_admissao" timestamp NOT NULL,
	"foto_url" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pacientes_cpf_unique" UNIQUE("cpf")
);
--> statement-breakpoint
CREATE TABLE "registros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"profissional_id" uuid NOT NULL,
	"especialidade" "especialidade" NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"conteudo" text NOT NULL,
	"data_registro" timestamp DEFAULT now() NOT NULL,
	"anexos" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sinais_vitais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"profissional_id" uuid NOT NULL,
	"data_afericao" timestamp DEFAULT now() NOT NULL,
	"pressao_arterial_sistolica" integer,
	"pressao_arterial_diastolica" integer,
	"frequencia_cardiaca" integer,
	"frequencia_respiratoria" integer,
	"temperatura" integer,
	"saturacao_o2" integer,
	"glicemia" integer,
	"peso" integer,
	"altura" integer,
	"observacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha" text,
	"especialidade" "especialidade",
	"role" "role" DEFAULT 'profissional' NOT NULL,
	"registro_profissional" text,
	"image" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacoes_geriatricas" ADD CONSTRAINT "avaliacoes_geriatricas_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacoes_geriatricas" ADD CONSTRAINT "avaliacoes_geriatricas_profissional_id_usuarios_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_instituicao_id_instituicoes_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros" ADD CONSTRAINT "registros_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros" ADD CONSTRAINT "registros_profissional_id_usuarios_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinais_vitais" ADD CONSTRAINT "sinais_vitais_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinais_vitais" ADD CONSTRAINT "sinais_vitais_profissional_id_usuarios_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_instituicao_id_instituicoes_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicoes"("id") ON DELETE no action ON UPDATE no action;