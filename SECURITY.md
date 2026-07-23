# Security Policy

## Supported Versions / Versões Suportadas

| Version | Supported |
|---------|-----------|
| 1.x.x   | ✅ Sim     |
| < 1.0   | ❌ Não     |

## Reporting a Vulnerability / Reportando uma Vulnerabilidade

**Please do not report security vulnerabilities through public GitHub issues.**

**Não reporte vulnerabilidades de segurança através de issues públicas no GitHub.**

To report a security vulnerability, please email **claudio@integraisenior.com** with:

Para reportar uma vulnerabilidade de segurança, envie um e-mail para **claudio@integraisenior.com** com:

- A description of the vulnerability / Uma descrição da vulnerabilidade
- Steps to reproduce / Passos para reproduzir
- The version/commit affected / A versão/commit afetada
- Your contact information / Suas informações de contato

You should receive a response within 48 hours. If the vulnerability is confirmed, we will work on a fix and release a patch within 7 days.

Você deve receber uma resposta em até 48 horas. Se a vulnerabilidade for confirmada, trabalharemos em uma correção e lançaremos um patch em até 7 dias.

## Security Considerations / Considerações de Segurança

- All data is multi-tenant isolated by `instituicaoId` / Todos os dados são isolados multi-tenant por `instituicaoId`
- Passwords are hashed using Better-Auth / Senhas são criptografadas usando Better-Auth
- HTTPS is required in production / HTTPS é obrigatório em produção
- Database credentials must be kept in `.env.local` / Credenciais do banco devem estar em `.env.local`
