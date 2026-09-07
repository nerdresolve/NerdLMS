-- =============================================================================
-- Seed de homologação — usuários, catálogo e matrículas.
--
-- GERADO POR `node infra/tools/build-seed.mjs`. Não edite à mão: os dados vêm
-- de `apps/frontend/src/mocks/data.ts`, e é de lá que as telas leem. Editar só
-- aqui faria o banco contar uma história diferente da interface.
--
-- NUNCA RODE EM PRODUÇÃO. As senhas são derivadas do login (`admin.mock` tem
-- senha `adminmock`), o que é adequado para homologação e inaceitável fora
-- dela. O bloco abaixo recusa a execução se o banco não parecer de HML.
-- =============================================================================

BEGIN;

-- Trava explícita. O seed só roda se quem o executa afirmar, no comando, que
-- este banco é de homologação:
--
--   psql -v allow_seed=yes -f hml.sql
--
-- Rodar sem isso falha e nada é escrito. É deliberado: um seed com senha
-- previsível não pode entrar em produção por descuido de quem digitou o
-- comando errado.
\if :{?allow_seed}
\else
  \echo 'ERRO: seed de HML. Rode com -v allow_seed=yes se este banco for de homologação.'
  \quit 1
\endif

-- ----------------------------------------------------------------- usuários
-- `ON CONFLICT` mantém o seed reaplicável, como as migrações 001 e 002.
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('58a9bb76-23b8-550e-8122-09cd019f99f0', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Sede' LIMIT 1),
        'admin.mock@exemplo.com', 'Administrador', '$scrypt$ln=17,r=8,p=1$qxRSv5vMkJPYiBlKUIxdEQ$tu23H3BalMxRDYFdXmUuYA7PcKq94qZNHR0nPKOjp+Y',
        'admin', 'active', 'Sede', 'Aracaju',
        '2026-08-12T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('c74c631a-3d85-5bb1-a040-19b48741ef2c', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Central' LIMIT 1),
        'manager.mock@exemplo.com', 'Gestor', '$scrypt$ln=17,r=8,p=1$CnkQWo2EKFePgSRgnmCR+Q$6/wXHuVdg3AKe6+FlNjRaZqzhCoNV8RClyojvDAdLv0',
        'manager', 'active', 'Unidade Central', 'Unidade Central',
        '2026-08-10T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('0241e68a-9b21-5658-bcd4-55cfa515d63c', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Central' LIMIT 1),
        'instructor.mock@exemplo.com', 'Instrutor', '$scrypt$ln=17,r=8,p=1$K4soSdssm6YKYGLP52qsQQ$btcFAY7l0iDFQ3s00TfRKVifiWcgIRAoepTRx7i14RM',
        'instructor', 'active', 'Unidade Central', 'Unidade Central',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Oeste' LIMIT 1),
        'instructor2.mock@exemplo.com', 'Instrutor 2', '$scrypt$ln=17,r=8,p=1$ckM43sBCEi+xdrwkfj+9WQ$vkfDKJy13oesZfwwrl+ddI8HclFQuJR9d/MrtdtPHQw',
        'instructor', 'active', 'Unidade Oeste', 'Japaratuba',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Leste' LIMIT 1),
        'user.mock@exemplo.com', 'Aluno', '$scrypt$ln=17,r=8,p=1$8EElRqGSbqcoXgV0ccRShQ$ZGlj3HgA9+44qdrGmrxmmr/yLAyn4IyjzrjUqWquYNA',
        'learner', 'active', 'Unidade Leste', 'Rosário do Catete',
        '2026-08-11T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('26757df8-30c8-5c63-805a-197a8d9593db', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Central' LIMIT 1),
        'joao.peixoto@exemplo.com', 'João Peixoto', NULL,
        'learner', 'active', 'Unidade Central', 'Unidade Central',
        '2026-08-12T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('bb1f7d87-6677-544a-af56-3d38c5e3ca65', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Leste' LIMIT 1),
        'carla.menezes@exemplo.com', 'Carla Menezes', NULL,
        'learner', 'active', 'Unidade Leste', 'Rosário do Catete',
        '2026-08-06T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('cde71ffa-eb22-541b-af5f-88f1b9bec629', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Oeste' LIMIT 1),
        'diego.ramos@exemplo.com', 'Diego Ramos', NULL,
        'learner', 'active', 'Unidade Oeste', 'Japaratuba',
        '2026-07-31T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('fdf36cb8-b946-59ac-9d69-90756d18a0dc', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Sul' LIMIT 1),
        'priscila.alves@exemplo.com', 'Priscila Alves', NULL,
        'learner', 'active', 'Unidade Sul', 'Unidade Central',
        '2026-07-25T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('d958b9da-9f14-57db-ac67-8cd7fc77c167', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Central' LIMIT 1),
        'marcos.tavares@exemplo.com', 'Marcos Tavares', NULL,
        'learner', 'active', 'Unidade Central', 'Rosário do Catete',
        '2026-07-19T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('ae870e0b-ede4-51ef-8f59-05172aa84a08', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Leste' LIMIT 1),
        'helena.duarte@exemplo.com', 'Helena Duarte', NULL,
        'learner', 'pending', 'Unidade Leste', 'Japaratuba',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Oeste' LIMIT 1),
        'rogerio.lima@exemplo.com', 'Rogério Lima', NULL,
        'learner', 'active', 'Unidade Oeste', 'Unidade Central',
        '2026-07-07T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', (SELECT id FROM tenants WHERE slug = 'exemplo'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'exemplo') AND name = 'Unidade Sul' LIMIT 1),
        'bianca.ferraz@exemplo.com', 'Bianca Ferraz', NULL,
        'learner', 'pending', 'Unidade Sul', 'Rosário do Catete',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;

-- ------------------------------------------------------------------- cursos
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('cf9de71e-2aa2-5c0f-928b-0c8b211c512c', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        '0241e68a-9b21-5658-bcd4-55cfa515d63c', 'operacao-de-pocos-fundamentos', 'Operação de Poços: Fundamentos',
        'Do reservatório à estação coletora: as etapas que levam o óleo do poço à transferência.', 'published', 'assigned')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('8145bed3-edf2-55a1-836a-392900cd3d7e', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        '0241e68a-9b21-5658-bcd4-55cfa515d63c', 'integridade-de-ativos', 'Integridade de Ativos e Corrosão',
        'Como medir, localizar e conter a perda de espessura em linhas, vasos e tanques.', 'published', 'assigned')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('57cfcb32-8049-5ba4-9c92-45351df8de19', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', 'seguranca-em-operacoes-de-campo', 'Segurança em Operações de Campo',
        'Procedimentos obrigatórios para trabalho a quente, espaço confinado e atmosfera com H₂S.', 'published', 'assigned')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('24c2669e-c4de-5632-81fb-6e761cc86d3f', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', 'relacionamento-com-comunidades', 'Relacionamento com Comunidades',
        'Escuta, clareza e resolução na relação com quem vive ao redor da operação.', 'published', 'open')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('c7027595-6095-521c-9087-8a2cb3efba5b', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', 'meio-ambiente-e-licenciamento', 'Meio Ambiente e Licenciamento',
        'Condicionantes, monitoramento e o que a operação precisa entregar ao órgão ambiental.', 'published', 'open')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('65c85afb-fd59-575d-8754-15fee87d6589', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        '0241e68a-9b21-5658-bcd4-55cfa515d63c', 'processamento-de-gas', 'Processamento e Tratamento de Gás',
        'Do separador ao ponto de entrega: as etapas do condicionamento e os parâmetros de especificação.', 'published', 'assigned')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', 'comunicacao-com-a-comunidade', 'Comunicação com a Comunidade',
        'Como explicar obra, intervenção e impacto para quem é afetado por eles.', 'published', 'open')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;

-- ---------------------------------------------------------- módulos e aulas
INSERT INTO modules (id, course_id, title, position)
VALUES ('4064f859-dff9-5e13-b269-d8263eaeaf76', 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'Reservatório e completação', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0163bc85-3f12-5418-94aa-d72ccf61ce78', '4064f859-dff9-5e13-b269-d8263eaeaf76', 'Rocha, óleo e água',
        1680, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('1569933a-99bf-5303-a01f-5a87cc9c71fb', '4064f859-dff9-5e13-b269-d8263eaeaf76', 'Perfuração direcional',
        1680, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('8d55e479-8d31-5961-9d30-28c83e530704', '4064f859-dff9-5e13-b269-d8263eaeaf76', 'Revestimento e cimentação',
        1680, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('fbba2eb4-ea03-5633-bde8-1baf605ec0e5', '4064f859-dff9-5e13-b269-d8263eaeaf76', 'Canhoneio',
        1680, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('f91d7510-682f-5bd2-af3e-feba78e8db1a', 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'Elevação artificial', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0df3ce97-0592-587a-b01a-aeaec3861a88', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Surgência e depleção',
        1800, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('f21ee8e1-2849-58da-9aff-773395036bf8', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Bombeio mecânico',
        1800, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('5abb4730-24a9-5083-aa53-be2360b77461', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Bombeio centrífugo submerso',
        1800, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('8fdf82ad-1fa6-5b86-9e23-f35313af5293', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Gas lift',
        1800, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('f43fb5f4-498b-5f7d-84b7-849d1329951d', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Escolha do método',
        1800, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('087b3034-72a4-5ca2-a810-d5272961a693', 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'Coleta e separação', 3)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('5e6f4c7b-912a-51e9-b7d8-31e3f93f347f', '087b3034-72a4-5ca2-a810-d5272961a693', 'Linhas de surgência',
        1560, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('bb137a86-2fcd-591f-8c80-064124a19cbe', '087b3034-72a4-5ca2-a810-d5272961a693', 'Estação coletora',
        1560, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('770ce5df-501f-54de-b722-37cf64d07095', '087b3034-72a4-5ca2-a810-d5272961a693', 'Separador trifásico',
        1560, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('9a4a2ce1-bd96-519e-8261-12f355f12452', '087b3034-72a4-5ca2-a810-d5272961a693', 'Tratamento de emulsão',
        1560, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('44f96898-759b-5d5a-9b1c-4c5be9769615', '087b3034-72a4-5ca2-a810-d5272961a693', 'Falhas comuns',
        1560, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('0839fcc1-0476-565c-89ba-003ee14153db', 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'Medição e controle', 4)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('d7ba7376-3820-5e12-a118-fa6c07fa9071', '0839fcc1-0476-565c-89ba-003ee14153db', 'Teste de poço',
        1920, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('5887dc59-2a83-5fbf-9b0f-75ae3aab3b26', '0839fcc1-0476-565c-89ba-003ee14153db', 'Medição fiscal',
        1920, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('163cfbda-0621-5db5-845a-45d4bfea32f9', '0839fcc1-0476-565c-89ba-003ee14153db', 'Análise de BSW',
        1920, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('a2572758-cd9b-52c0-adfc-b5ca8463538d', '0839fcc1-0476-565c-89ba-003ee14153db', 'Regulação da ANP',
        1920, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('3afe61f8-a922-5edd-80dd-f8283f0c9030', '8145bed3-edf2-55a1-836a-392900cd3d7e', 'Mecanismos de corrosão', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('04a9e4b1-e038-5d53-8340-bae65cb8b45e', '3afe61f8-a922-5edd-80dd-f8283f0c9030', 'Corrosão interna',
        1440, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('be13856f-86f3-5fd3-b326-53aad354890e', '3afe61f8-a922-5edd-80dd-f8283f0c9030', 'Corrosão externa',
        1440, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('d6f20afd-8737-5595-9b79-3ac70ac8990a', '3afe61f8-a922-5edd-80dd-f8283f0c9030', 'H₂S e CO₂',
        1440, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('e61af914-4366-5764-8b2a-59d6618bca07', '3afe61f8-a922-5edd-80dd-f8283f0c9030', 'Registro de anomalias',
        1440, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('f738a8c1-e584-5c23-9a15-bff9f7390a77', '8145bed3-edf2-55a1-836a-392900cd3d7e', 'Inspeção em campo', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('803daec1-89c1-5a4d-8373-3387775c36a6', 'f738a8c1-e584-5c23-9a15-bff9f7390a77', 'Inspeção visual',
        1620, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('37564443-a75a-5c8f-a4ba-19d2e853f14b', 'f738a8c1-e584-5c23-9a15-bff9f7390a77', 'Medição de espessura',
        1620, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0dde7e91-a3b7-511d-b950-8ceb3a98412e', 'f738a8c1-e584-5c23-9a15-bff9f7390a77', 'Ensaio não destrutivo',
        1620, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('a60927ac-bf7f-5db2-b822-0c85a595e262', 'f738a8c1-e584-5c23-9a15-bff9f7390a77', 'Reparo programado',
        1620, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('8c01febb-14b7-5114-8f6f-6b4afb658c90', '8145bed3-edf2-55a1-836a-392900cd3d7e', 'Proteção e mitigação', 3)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0edbef35-b53e-5ded-8e20-7e256d5e256d', '8c01febb-14b7-5114-8f6f-6b4afb658c90', 'Revestimento',
        1560, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('a7b58919-057f-563e-87dc-64a56b69b4c6', '8c01febb-14b7-5114-8f6f-6b4afb658c90', 'Proteção catódica',
        1560, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('ccae051e-bb66-5aa1-9d2b-3f3f0d7cfded', '8c01febb-14b7-5114-8f6f-6b4afb658c90', 'Injeção de inibidor',
        1560, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('71b79a7a-f1ef-590e-87d3-e852858dec3b', '8c01febb-14b7-5114-8f6f-6b4afb658c90', 'Gestão de anomalias',
        1560, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('77a8a967-24d7-5413-a6bf-376cc0cfdaca', '57cfcb32-8049-5ba4-9c92-45351df8de19', 'Fundamentos', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('530747dc-0cff-5b78-88a2-0bdd44e61fd2', '77a8a967-24d7-5413-a6bf-376cc0cfdaca', 'Análise preliminar de risco',
        1320, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('5308d5fd-9440-537b-a296-715b5408e602', '77a8a967-24d7-5413-a6bf-376cc0cfdaca', 'EPI e EPC',
        1320, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('311446b2-4e3e-5896-a428-81d060daa05c', '77a8a967-24d7-5413-a6bf-376cc0cfdaca', 'Permissão de trabalho',
        1320, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0b038a63-66d5-5461-bdfd-a9aab14ad79d', '77a8a967-24d7-5413-a6bf-376cc0cfdaca', 'Comunicação de incidentes',
        1320, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('799fa968-bb28-53f0-9c9c-920be3141eb6', '77a8a967-24d7-5413-a6bf-376cc0cfdaca', 'Primeiros socorros',
        1320, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('56e95570-bca2-5957-ba3e-43ba7a8c8bbe', '57cfcb32-8049-5ba4-9c92-45351df8de19', 'Trabalho a quente', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('ff404be9-3e5a-5aa0-8edb-063bef94509b', '56e95570-bca2-5957-ba3e-43ba7a8c8bbe', 'Liberação de área',
        1800, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('bd38cf1a-5b8b-5260-ad17-180f95b65923', '56e95570-bca2-5957-ba3e-43ba7a8c8bbe', 'Teste de explosividade',
        1800, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('868426c1-b467-5e65-8476-ca76d5e1b276', '56e95570-bca2-5957-ba3e-43ba7a8c8bbe', 'Bloqueio e etiquetagem',
        1800, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('828e9627-8a91-57bb-9702-ddcfecf4caca', '56e95570-bca2-5957-ba3e-43ba7a8c8bbe', 'Vigia de fogo',
        1800, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('84e11ae6-6894-540b-a0cf-c6e4c725ffb8', '56e95570-bca2-5957-ba3e-43ba7a8c8bbe', 'Isolamento da área',
        1800, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('b1743ff7-66b3-5338-bc6b-6b84ef057ac0', '57cfcb32-8049-5ba4-9c92-45351df8de19', 'Espaço confinado', 3)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('48a4caa0-bcb9-506b-9e32-5ee82b6ba7a5', 'b1743ff7-66b3-5338-bc6b-6b84ef057ac0', 'Identificação',
        2040, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('60145966-5399-5fab-a0ea-4308fdd432f8', 'b1743ff7-66b3-5338-bc6b-6b84ef057ac0', 'Monitoramento atmosférico',
        2040, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('bf525e14-6bf2-52f6-a8b4-d71afcfd5da7', 'b1743ff7-66b3-5338-bc6b-6b84ef057ac0', 'Ventilação',
        2040, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('378f73bd-d097-5d16-9e6d-14e4ee6b859a', 'b1743ff7-66b3-5338-bc6b-6b84ef057ac0', 'Resgate',
        2040, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('bed7ba87-21dd-5466-8f82-4d24ab7113ff', 'b1743ff7-66b3-5338-bc6b-6b84ef057ac0', 'Supervisão de entrada',
        2040, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('944e170a-1de0-5e63-97de-63a7bbf1869e', '57cfcb32-8049-5ba4-9c92-45351df8de19', 'Emergências', 4)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('cfa0aa80-593c-5eac-8f92-f99a2d8d0f9c', '944e170a-1de0-5e63-97de-63a7bbf1869e', 'Plano de resposta',
        1680, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('5bce3704-eb6a-5a8f-81d1-5152cc7dd7b7', '944e170a-1de0-5e63-97de-63a7bbf1869e', 'Vazamento de H₂S',
        1680, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('a70346df-df49-5632-a50b-fda56d9de913', '944e170a-1de0-5e63-97de-63a7bbf1869e', 'Evacuação',
        1680, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('a5ae63a9-0804-5ce0-bb51-eb888d6dde74', '944e170a-1de0-5e63-97de-63a7bbf1869e', 'Pós-ocorrência',
        1680, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('706a823e-2bd8-5404-845d-4b59f3440bc4', '944e170a-1de0-5e63-97de-63a7bbf1869e', 'Registro e análise',
        1680, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('ce63142b-913c-560f-bf78-1effb1ef1935', '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'A relação com a vizinhança', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('01412b8c-13a7-5f7f-9ef9-cbdfe51ca2ea', 'ce63142b-913c-560f-bf78-1effb1ef1935', 'Direitos e deveres',
        1200, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('420e6746-6fc0-5c18-8b0e-0b7066d79d2f', 'ce63142b-913c-560f-bf78-1effb1ef1935', 'Escuta ativa',
        1200, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('18ae4f26-87b7-591e-b04a-0333731c460b', 'ce63142b-913c-560f-bf78-1effb1ef1935', 'Linguagem clara',
        1200, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0b500745-d247-5ac6-a384-25124fb2f001', 'ce63142b-913c-560f-bf78-1effb1ef1935', 'Registro da manifestação',
        1200, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('49622b15-84a5-514c-b6d6-4753a7bd4ebf', 'ce63142b-913c-560f-bf78-1effb1ef1935', 'Prazos',
        1200, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('eb96e456-1801-5d27-86ab-d306e7417be4', '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'Situações críticas', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d', 'eb96e456-1801-5d27-86ab-d306e7417be4', 'Ruído e odor',
        1440, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('34849aa4-5fca-5429-8217-2cdc41901c86', 'eb96e456-1801-5d27-86ab-d306e7417be4', 'Dano em propriedade',
        1440, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('bae50460-5bd8-531f-bf47-e3894adfacbd', 'eb96e456-1801-5d27-86ab-d306e7417be4', 'Reclamação recorrente',
        1440, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('8322791f-513f-58ce-9fde-e56590c0331a', 'eb96e456-1801-5d27-86ab-d306e7417be4', 'Escalonamento',
        1440, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('484a41a8-bf93-5a9e-b472-feb9023082ab', '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'Qualidade', 3)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('2de36a0e-c91f-5231-bc7b-65246762dc41', '484a41a8-bf93-5a9e-b472-feb9023082ab', 'Indicadores de atendimento',
        1320, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('6c5d996c-a98b-57b6-a631-a05467f62644', '484a41a8-bf93-5a9e-b472-feb9023082ab', 'Pesquisa de satisfação',
        1320, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('ce7f1eb3-547e-5db8-b767-14813f1a7223', '484a41a8-bf93-5a9e-b472-feb9023082ab', 'Melhoria contínua',
        1320, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('7645a1ec-d116-5ed4-9859-27d5ed3a7121', '484a41a8-bf93-5a9e-b472-feb9023082ab', 'Casos comentados',
        1320, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('6d71aad7-35c9-5286-b4bd-edcc4f45b713', '484a41a8-bf93-5a9e-b472-feb9023082ab', 'Encerramento',
        1320, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('2dc9fc55-9a15-5abd-ab1c-61b71fc9152e', 'c7027595-6095-521c-9087-8a2cb3efba5b', 'Fundamentos', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('ac2197e2-a19d-53f0-91fe-fd01c52204d7', '2dc9fc55-9a15-5abd-ab1c-61b71fc9152e', 'Legislação ambiental',
        1560, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('9b79a442-5df4-51d7-83d4-ab98d4714921', '2dc9fc55-9a15-5abd-ab1c-61b71fc9152e', 'Licenças e condicionantes',
        1560, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('6167b04a-2c7d-53eb-b5d7-3409c8adf32e', '2dc9fc55-9a15-5abd-ab1c-61b71fc9152e', 'O papel da operação',
        1560, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('ec8fd3d1-e5e3-57bd-977d-495e37aae9ac', 'c7027595-6095-521c-9087-8a2cb3efba5b', 'Monitoramento e passivos', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0e5a7042-9841-5e9c-b216-0dc47403d806', 'ec8fd3d1-e5e3-57bd-977d-495e37aae9ac', 'Água, solo e fauna',
        1800, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('4f0aeaf3-e518-5b89-b84c-16793a53ff55', 'ec8fd3d1-e5e3-57bd-977d-495e37aae9ac', 'Gestão de resíduos',
        1800, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('400cc800-f043-51ae-9e58-edd6e14c145a', 'ec8fd3d1-e5e3-57bd-977d-495e37aae9ac', 'Recuperação de áreas',
        1800, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('4d3fddd1-9d95-52fe-b4b4-7a81e505a3c5', '65c85afb-fd59-575d-8754-15fee87d6589', 'Condicionamento', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('bcfcc07a-a6ba-50bd-82b7-6bcc64bcd751', '4d3fddd1-9d95-52fe-b4b4-7a81e505a3c5', 'Separação primária',
        1440, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('64d7715a-b177-51bc-a79c-2ca99ebc4b65', '4d3fddd1-9d95-52fe-b4b4-7a81e505a3c5', 'Desidratação',
        1440, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('e6f2874b-388a-5dc9-ac11-0e322a983e52', '4d3fddd1-9d95-52fe-b4b4-7a81e505a3c5', 'Compressão',
        1440, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('3fc96e20-0baf-5894-a540-f78ffb22452e', '4d3fddd1-9d95-52fe-b4b4-7a81e505a3c5', 'Operação',
        1440, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('6862261d-36e2-576c-bef0-0337e82f0d98', '65c85afb-fd59-575d-8754-15fee87d6589', 'Especificação e entrega', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('8acdfd07-d366-5d00-9c2e-721efc1abe59', '6862261d-36e2-576c-bef0-0337e82f0d98', 'Remoção de H₂S',
        1920, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('9ca0aa0c-d47c-5057-ab06-27498e1efa10', '6862261d-36e2-576c-bef0-0337e82f0d98', 'Ponto de orvalho',
        1920, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('30b344aa-5997-5ed1-a772-ea391203bd98', '6862261d-36e2-576c-bef0-0337e82f0d98', 'Controle de processo',
        1920, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('1bec7c64-be5c-5ff2-9fa9-60d29b558f69', '6862261d-36e2-576c-bef0-0337e82f0d98', 'Medição na entrega',
        1920, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('87688102-f2af-58c6-bb61-1e9db030fe55', '8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', 'Antes da obra', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('023ea900-f88f-56b6-9759-be32f5d701cf', '87688102-f2af-58c6-bb61-1e9db030fe55', 'Mapeamento de impacto',
        1320, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('9d20a773-86ca-504d-bab5-a40e828eb4b5', '87688102-f2af-58c6-bb61-1e9db030fe55', 'Linguagem clara',
        1320, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('f706663e-7dae-5d66-889b-462d809d9ba2', '87688102-f2af-58c6-bb61-1e9db030fe55', 'Canais de aviso',
        1320, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('1dbc7cef-0bd0-5d8a-a82e-60f55acd5445', '8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', 'Durante e depois', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('2f43c0d0-175b-549f-9a91-1ed16aa92a18', '1dbc7cef-0bd0-5d8a-a82e-60f55acd5445', 'Gestão de reclamação',
        1500, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('198b4f3e-62cc-5a18-9602-f588756bb4bf', '1dbc7cef-0bd0-5d8a-a82e-60f55acd5445', 'Prestação de contas',
        1500, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('aaa30c42-e4bb-5276-b6b3-a19a4623c630', '1dbc7cef-0bd0-5d8a-a82e-60f55acd5445', 'Escuta ativa',
        1500, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;

-- --------------------------------------------------------------- matrículas
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64',
        'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687',
        'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', true)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '0163bc85-3f12-5418-94aa-d72ccf61ce78',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '1569933a-99bf-5303-a01f-5a87cc9c71fb',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '8d55e479-8d31-5961-9d30-28c83e530704',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', 'fbba2eb4-ea03-5633-bde8-1baf605ec0e5',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '0df3ce97-0592-587a-b01a-aeaec3861a88',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', 'f21ee8e1-2849-58da-9aff-773395036bf8',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '5abb4730-24a9-5083-aa53-be2360b77461',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '8fdf82ad-1fa6-5b86-9e23-f35313af5293',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', 'f43fb5f4-498b-5f7d-84b7-849d1329951d',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '5e6f4c7b-912a-51e9-b7d8-31e3f93f347f',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', 'bb137a86-2fcd-591f-8c80-064124a19cbe',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '770ce5df-501f-54de-b722-37cf64d07095',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '9a4a2ce1-bd96-519e-8261-12f355f12452',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('742655ba-ad99-5a58-960e-a35cbd02bb64', '44f96898-759b-5d5a-9b1c-4c5be9769615',
        546, 546,
        NULL, NULL)
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('b337627b-50b5-5a00-82d6-25cf6690ebf6',
        '8145bed3-edf2-55a1-836a-392900cd3d7e', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687',
        'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b337627b-50b5-5a00-82d6-25cf6690ebf6', '04a9e4b1-e038-5d53-8340-bae65cb8b45e',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b337627b-50b5-5a00-82d6-25cf6690ebf6', 'be13856f-86f3-5fd3-b326-53aad354890e',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b337627b-50b5-5a00-82d6-25cf6690ebf6', 'd6f20afd-8737-5595-9b79-3ac70ac8990a',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b337627b-50b5-5a00-82d6-25cf6690ebf6', 'e61af914-4366-5764-8b2a-59d6618bca07',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b337627b-50b5-5a00-82d6-25cf6690ebf6', '803daec1-89c1-5a4d-8373-3387775c36a6',
        567, 567,
        NULL, NULL)
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('68a379be-251b-50d8-9bd8-9dd676afa870',
        '57cfcb32-8049-5ba4-9c92-45351df8de19', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687',
        'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', true)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255',
        '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687',
        'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '01412b8c-13a7-5f7f-9ef9-cbdfe51ca2ea',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '420e6746-6fc0-5c18-8b0e-0b7066d79d2f',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '18ae4f26-87b7-591e-b04a-0333731c460b',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '0b500745-d247-5ac6-a384-25124fb2f001',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '49622b15-84a5-514c-b6d6-4753a7bd4ebf',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '34849aa4-5fca-5429-8217-2cdc41901c86',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', 'bae50460-5bd8-531f-bf47-e3894adfacbd',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '8322791f-513f-58ce-9fde-e56590c0331a',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '2de36a0e-c91f-5231-bc7b-65246762dc41',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '6c5d996c-a98b-57b6-a631-a05467f62644',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', 'ce7f1eb3-547e-5db8-b767-14813f1a7223',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '7645a1ec-d116-5ed4-9859-27d5ed3a7121',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f645caeb-5bcb-5eee-b4d0-534f8aec5255', '6d71aad7-35c9-5286-b4bd-edcc4f45b713',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('357d93e5-977d-5da5-9afc-d62ace3a77db',
        'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', '26757df8-30c8-5c63-805a-197a8d9593db',
        '26757df8-30c8-5c63-805a-197a8d9593db', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b',
        '57cfcb32-8049-5ba4-9c92-45351df8de19', '26757df8-30c8-5c63-805a-197a8d9593db',
        '26757df8-30c8-5c63-805a-197a8d9593db', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', '530747dc-0cff-5b78-88a2-0bdd44e61fd2',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', '5308d5fd-9440-537b-a296-715b5408e602',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', '311446b2-4e3e-5896-a428-81d060daa05c',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', '0b038a63-66d5-5461-bdfd-a9aab14ad79d',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', '799fa968-bb28-53f0-9c9c-920be3141eb6',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', 'ff404be9-3e5a-5aa0-8edb-063bef94509b',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', 'bd38cf1a-5b8b-5260-ad17-180f95b65923',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', '868426c1-b467-5e65-8476-ca76d5e1b276',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', '828e9627-8a91-57bb-9702-ddcfecf4caca',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4993cd02-07b7-5f2c-bfb6-2b73aed4c12b', '84e11ae6-6894-540b-a0cf-c6e4c725ffb8',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('301a5c3d-2ab3-558d-b191-a38849c77ed1',
        '8145bed3-edf2-55a1-836a-392900cd3d7e', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65',
        'bb1f7d87-6677-544a-af56-3d38c5e3ca65', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('301a5c3d-2ab3-558d-b191-a38849c77ed1', '04a9e4b1-e038-5d53-8340-bae65cb8b45e',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('301a5c3d-2ab3-558d-b191-a38849c77ed1', 'be13856f-86f3-5fd3-b326-53aad354890e',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('301a5c3d-2ab3-558d-b191-a38849c77ed1', 'd6f20afd-8737-5595-9b79-3ac70ac8990a',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256',
        '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65',
        'bb1f7d87-6677-544a-af56-3d38c5e3ca65', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '01412b8c-13a7-5f7f-9ef9-cbdfe51ca2ea',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '420e6746-6fc0-5c18-8b0e-0b7066d79d2f',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '18ae4f26-87b7-591e-b04a-0333731c460b',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '0b500745-d247-5ac6-a384-25124fb2f001',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '49622b15-84a5-514c-b6d6-4753a7bd4ebf',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '34849aa4-5fca-5429-8217-2cdc41901c86',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', 'bae50460-5bd8-531f-bf47-e3894adfacbd',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '8322791f-513f-58ce-9fde-e56590c0331a',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '2de36a0e-c91f-5231-bc7b-65246762dc41',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('e9f0548e-ff2e-5ecd-bd0b-1285757c6256', '6c5d996c-a98b-57b6-a631-a05467f62644',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc',
        '57cfcb32-8049-5ba4-9c92-45351df8de19', 'cde71ffa-eb22-541b-af5f-88f1b9bec629',
        'cde71ffa-eb22-541b-af5f-88f1b9bec629', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', '530747dc-0cff-5b78-88a2-0bdd44e61fd2',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', '5308d5fd-9440-537b-a296-715b5408e602',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', '311446b2-4e3e-5896-a428-81d060daa05c',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', '0b038a63-66d5-5461-bdfd-a9aab14ad79d',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', '799fa968-bb28-53f0-9c9c-920be3141eb6',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', 'ff404be9-3e5a-5aa0-8edb-063bef94509b',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', 'bd38cf1a-5b8b-5260-ad17-180f95b65923',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', '868426c1-b467-5e65-8476-ca76d5e1b276',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', '828e9627-8a91-57bb-9702-ddcfecf4caca',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('3ca60098-49b8-5dfc-928f-f82c2c0151cc', '84e11ae6-6894-540b-a0cf-c6e4c725ffb8',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a',
        'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'cde71ffa-eb22-541b-af5f-88f1b9bec629',
        'cde71ffa-eb22-541b-af5f-88f1b9bec629', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '0163bc85-3f12-5418-94aa-d72ccf61ce78',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '1569933a-99bf-5303-a01f-5a87cc9c71fb',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '8d55e479-8d31-5961-9d30-28c83e530704',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', 'fbba2eb4-ea03-5633-bde8-1baf605ec0e5',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '0df3ce97-0592-587a-b01a-aeaec3861a88',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', 'f21ee8e1-2849-58da-9aff-773395036bf8',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '5abb4730-24a9-5083-aa53-be2360b77461',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '8fdf82ad-1fa6-5b86-9e23-f35313af5293',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', 'f43fb5f4-498b-5f7d-84b7-849d1329951d',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '5e6f4c7b-912a-51e9-b7d8-31e3f93f347f',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', 'bb137a86-2fcd-591f-8c80-064124a19cbe',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '770ce5df-501f-54de-b722-37cf64d07095',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '9a4a2ce1-bd96-519e-8261-12f355f12452',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '44f96898-759b-5d5a-9b1c-4c5be9769615',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', 'd7ba7376-3820-5e12-a118-fa6c07fa9071',
        1920, 1920,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '5887dc59-2a83-5fbf-9b0f-75ae3aab3b26',
        1920, 1920,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', '163cfbda-0621-5db5-845a-45d4bfea32f9',
        1920, 1920,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('2af3b4af-fcf1-5767-a9e5-610d5f5ddb5a', 'a2572758-cd9b-52c0-adfc-b5ca8463538d',
        1920, 1920,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731',
        '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc',
        'fdf36cb8-b946-59ac-9d69-90756d18a0dc', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '01412b8c-13a7-5f7f-9ef9-cbdfe51ca2ea',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '420e6746-6fc0-5c18-8b0e-0b7066d79d2f',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '18ae4f26-87b7-591e-b04a-0333731c460b',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '0b500745-d247-5ac6-a384-25124fb2f001',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '49622b15-84a5-514c-b6d6-4753a7bd4ebf',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '34849aa4-5fca-5429-8217-2cdc41901c86',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', 'bae50460-5bd8-531f-bf47-e3894adfacbd',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '8322791f-513f-58ce-9fde-e56590c0331a',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '2de36a0e-c91f-5231-bc7b-65246762dc41',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('f516aa42-f42b-5a12-acc6-b51a13e5e731', '6c5d996c-a98b-57b6-a631-a05467f62644',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('7c67e98a-6bce-5aa8-8a2e-ab01c9ae103f',
        '8145bed3-edf2-55a1-836a-392900cd3d7e', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc',
        'fdf36cb8-b946-59ac-9d69-90756d18a0dc', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f',
        'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'd958b9da-9f14-57db-ac67-8cd7fc77c167',
        'd958b9da-9f14-57db-ac67-8cd7fc77c167', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '0163bc85-3f12-5418-94aa-d72ccf61ce78',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '1569933a-99bf-5303-a01f-5a87cc9c71fb',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '8d55e479-8d31-5961-9d30-28c83e530704',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', 'fbba2eb4-ea03-5633-bde8-1baf605ec0e5',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '0df3ce97-0592-587a-b01a-aeaec3861a88',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', 'f21ee8e1-2849-58da-9aff-773395036bf8',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '5abb4730-24a9-5083-aa53-be2360b77461',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '8fdf82ad-1fa6-5b86-9e23-f35313af5293',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', 'f43fb5f4-498b-5f7d-84b7-849d1329951d',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '5e6f4c7b-912a-51e9-b7d8-31e3f93f347f',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', 'bb137a86-2fcd-591f-8c80-064124a19cbe',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '770ce5df-501f-54de-b722-37cf64d07095',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '9a4a2ce1-bd96-519e-8261-12f355f12452',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '44f96898-759b-5d5a-9b1c-4c5be9769615',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', 'd7ba7376-3820-5e12-a118-fa6c07fa9071',
        1920, 1920,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '5887dc59-2a83-5fbf-9b0f-75ae3aab3b26',
        1920, 1920,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', '163cfbda-0621-5db5-845a-45d4bfea32f9',
        1920, 1920,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('70c9a473-137e-5368-adc6-963d3c22aa5f', 'a2572758-cd9b-52c0-adfc-b5ca8463538d',
        1920, 1920,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('cb4eb23a-776d-5562-a9c1-008238c6a020',
        '57cfcb32-8049-5ba4-9c92-45351df8de19', 'd958b9da-9f14-57db-ac67-8cd7fc77c167',
        'd958b9da-9f14-57db-ac67-8cd7fc77c167', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('cb4eb23a-776d-5562-a9c1-008238c6a020', '530747dc-0cff-5b78-88a2-0bdd44e61fd2',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('cb4eb23a-776d-5562-a9c1-008238c6a020', '5308d5fd-9440-537b-a296-715b5408e602',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('cb4eb23a-776d-5562-a9c1-008238c6a020', '311446b2-4e3e-5896-a428-81d060daa05c',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('cb4eb23a-776d-5562-a9c1-008238c6a020', '0b038a63-66d5-5461-bdfd-a9aab14ad79d',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('cb4eb23a-776d-5562-a9c1-008238c6a020', '799fa968-bb28-53f0-9c9c-920be3141eb6',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('90728fd5-cd66-5a05-b66c-787510678d53',
        '8145bed3-edf2-55a1-836a-392900cd3d7e', 'ae870e0b-ede4-51ef-8f59-05172aa84a08',
        'ae870e0b-ede4-51ef-8f59-05172aa84a08', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('4f526391-bdde-54a3-bb6a-edd69d51176b',
        '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'ae870e0b-ede4-51ef-8f59-05172aa84a08',
        'ae870e0b-ede4-51ef-8f59-05172aa84a08', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4f526391-bdde-54a3-bb6a-edd69d51176b', '01412b8c-13a7-5f7f-9ef9-cbdfe51ca2ea',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4f526391-bdde-54a3-bb6a-edd69d51176b', '420e6746-6fc0-5c18-8b0e-0b7066d79d2f',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4f526391-bdde-54a3-bb6a-edd69d51176b', '18ae4f26-87b7-591e-b04a-0333731c460b',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4f526391-bdde-54a3-bb6a-edd69d51176b', '0b500745-d247-5ac6-a384-25124fb2f001',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4f526391-bdde-54a3-bb6a-edd69d51176b', '49622b15-84a5-514c-b6d6-4753a7bd4ebf',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4f526391-bdde-54a3-bb6a-edd69d51176b', '5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4f526391-bdde-54a3-bb6a-edd69d51176b', '34849aa4-5fca-5429-8217-2cdc41901c86',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('4ff5802a-ebf4-594d-a742-4cb49ef76930',
        '57cfcb32-8049-5ba4-9c92-45351df8de19', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9',
        'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4ff5802a-ebf4-594d-a742-4cb49ef76930', '530747dc-0cff-5b78-88a2-0bdd44e61fd2',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4ff5802a-ebf4-594d-a742-4cb49ef76930', '5308d5fd-9440-537b-a296-715b5408e602',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4ff5802a-ebf4-594d-a742-4cb49ef76930', '311446b2-4e3e-5896-a428-81d060daa05c',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4ff5802a-ebf4-594d-a742-4cb49ef76930', '0b038a63-66d5-5461-bdfd-a9aab14ad79d',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('4ff5802a-ebf4-594d-a742-4cb49ef76930', '799fa968-bb28-53f0-9c9c-920be3141eb6',
        1320, 1320,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42',
        'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9',
        'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '0163bc85-3f12-5418-94aa-d72ccf61ce78',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '1569933a-99bf-5303-a01f-5a87cc9c71fb',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '8d55e479-8d31-5961-9d30-28c83e530704',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', 'fbba2eb4-ea03-5633-bde8-1baf605ec0e5',
        1680, 1680,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '0df3ce97-0592-587a-b01a-aeaec3861a88',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', 'f21ee8e1-2849-58da-9aff-773395036bf8',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '5abb4730-24a9-5083-aa53-be2360b77461',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '8fdf82ad-1fa6-5b86-9e23-f35313af5293',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', 'f43fb5f4-498b-5f7d-84b7-849d1329951d',
        1800, 1800,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '5e6f4c7b-912a-51e9-b7d8-31e3f93f347f',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', 'bb137a86-2fcd-591f-8c80-064124a19cbe',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '770ce5df-501f-54de-b722-37cf64d07095',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '9a4a2ce1-bd96-519e-8261-12f355f12452',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('b75293c8-352c-5f0b-b471-c386a6b4ca42', '44f96898-759b-5d5a-9b1c-4c5be9769615',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('46419521-3e2a-53cc-bfa5-100ddddb4a21',
        '24c2669e-c4de-5632-81fb-6e761cc86d3f', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573',
        '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('46419521-3e2a-53cc-bfa5-100ddddb4a21', '01412b8c-13a7-5f7f-9ef9-cbdfe51ca2ea',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('46419521-3e2a-53cc-bfa5-100ddddb4a21', '420e6746-6fc0-5c18-8b0e-0b7066d79d2f',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('46419521-3e2a-53cc-bfa5-100ddddb4a21', '18ae4f26-87b7-591e-b04a-0333731c460b',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('46419521-3e2a-53cc-bfa5-100ddddb4a21', '0b500745-d247-5ac6-a384-25124fb2f001',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('46419521-3e2a-53cc-bfa5-100ddddb4a21', '49622b15-84a5-514c-b6d6-4753a7bd4ebf',
        1200, 1200,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('46419521-3e2a-53cc-bfa5-100ddddb4a21', '5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('46419521-3e2a-53cc-bfa5-100ddddb4a21', '34849aa4-5fca-5429-8217-2cdc41901c86',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO enrollments (id, course_id, learner_id, enrolled_by, saved)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008',
        '8145bed3-edf2-55a1-836a-392900cd3d7e', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573',
        '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', false)
ON CONFLICT (course_id, learner_id) DO UPDATE SET saved = EXCLUDED.saved;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', '04a9e4b1-e038-5d53-8340-bae65cb8b45e',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', 'be13856f-86f3-5fd3-b326-53aad354890e',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', 'd6f20afd-8737-5595-9b79-3ac70ac8990a',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', 'e61af914-4366-5764-8b2a-59d6618bca07',
        1440, 1440,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', '803daec1-89c1-5a4d-8373-3387775c36a6',
        1620, 1620,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', '37564443-a75a-5c8f-a4ba-19d2e853f14b',
        1620, 1620,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', '0dde7e91-a3b7-511d-b950-8ceb3a98412e',
        1620, 1620,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', 'a60927ac-bf7f-5db2-b822-0c85a595e262',
        1620, 1620,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', '0edbef35-b53e-5ded-8e20-7e256d5e256d',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', 'a7b58919-057f-563e-87dc-64a56b69b4c6',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', 'ccae051e-bb66-5aa1-9d2b-3f3f0d7cfded',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;
INSERT INTO lesson_progress (enrollment_id, lesson_id, watched_seconds,
                             last_position_seconds, completed_at, completion_source)
VALUES ('a1ad3719-1562-51d2-a434-0e004447d008', '71b79a7a-f1ef-590e-87d3-e852858dec3b',
        1560, 1560,
        now(), 'auto')
ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
  watched_seconds = EXCLUDED.watched_seconds,
  last_position_seconds = EXCLUDED.last_position_seconds,
  completed_at = EXCLUDED.completed_at,
  completion_source = EXCLUDED.completion_source;

-- -------------------------------------------------------------- comentários
-- `highlighted` é recalculado a partir da autoria do curso, não copiado do
-- mock: é o servidor que decide quem aparece como professor (PRD §8), e o
-- seed não pode ser a exceção que contradiz a regra.
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('7a9dbf21-36ed-5020-a33e-ef95a87f1369', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687',
        NULL, 'O trecho sobre a altura da interface no separador esclareceu uma dúvida que eu tinha há tempos. Vale rever a partir dos 12 minutos.',
        false, '2026-08-05T09:44:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('b8a8acb7-d04e-55c0-ac9b-10018845d91e', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65',
        NULL, 'Uma dica prática: registre o nível da interface no início e no fim do turno. Em duas semanas você já enxerga o padrão do seu separador sem precisar de planilha.',
        false, '2026-08-05T14:10:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('f66d7227-9a82-55b5-9c7e-5fee781b7c0b', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc',
        NULL, 'Alguém tem o link da norma citada no minuto 18?',
        false, '2026-08-06T08:02:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('06302eca-6b79-53fc-b4a6-3b4065a894a3', '60145966-5399-5fab-a0ea-4308fdd432f8', 'cde71ffa-eb22-541b-af5f-88f1b9bec629',
        NULL, 'Pergunta sobre o monitoramento antes da entrada: o detector aponta 19,2% de oxigênio. Está abaixo dos 20,9% do ar, mas acima do limite que a aula citou. Entra ou não entra?',
        false, '2026-08-07T07:35:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', '60145966-5399-5fab-a0ea-4308fdd432f8', '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b',
        '06302eca-6b79-53fc-b4a6-3b4065a894a3', 'Não entra. O limite de 19,5% não é uma linha que separa seguro de inseguro: é o ponto em que a medição já indica que alguma coisa consumiu ou deslocou o oxigênio. Enquanto você não souber o que foi, o espaço continua sem liberação. Ventile e meça de novo. Se não voltar ao normal, o motivo está lá dentro.',
        true, '2026-08-07T09:12:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('7a7092c6-00cf-5780-a18d-208b78278ede', '60145966-5399-5fab-a0ea-4308fdd432f8', 'd958b9da-9f14-57db-ac67-8cd7fc77c167',
        NULL, 'Complementando: aqui a gente adotou medir nos três níveis do tanque, e não só na boca de visita. Já achamos diferença de quase 2% entre o topo e o fundo.',
        false, '2026-08-07T10:48:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('454419ad-5ffe-5e68-af8e-af966bc3d31d', '5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65',
        NULL, 'O que fazer quando a pessoa liga pela terceira vez no mesmo dia sobre o mesmo odor? O protocolo continua o mesmo, mas ela já está sem paciência com o roteiro.',
        false, '2026-08-08T11:20:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', '5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d', '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b',
        '454419ad-5ffe-5e68-af8e-af966bc3d31d', 'Nesse caso o roteiro atrapalha. Na terceira ligação a pessoa não quer a explicação de novo, quer saber o que mudou desde a última. Abra dizendo o que já foi feito e qual é a previsão atual, mesmo que a previsão seja ruim. Repetir o script do zero soa como se ninguém tivesse olhado o caso.',
        true, '2026-08-08T14:05:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('dd5b233e-55e8-54eb-8637-7346836bd80d', '18ae4f26-87b7-591e-b04a-0333731c460b', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9',
        NULL, 'A parte de trocar termo técnico por linguagem comum ajudou. Aqui a gente falava "queima em tocha" e a pessoa entendia que tinha pegado fogo na estação.',
        false, '2026-08-09T16:30:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', '37564443-a75a-5c8f-a4ba-19d2e853f14b', '26757df8-30c8-5c63-805a-197a8d9593db',
        NULL, 'Na medição de espessura, a linha quente do nosso trecho dá leitura instável o dia inteiro. Alguém consegue medir com a linha em operação ou aqui é caso de esperar a parada mesmo?',
        false, '2026-08-10T08:15:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', '37564443-a75a-5c8f-a4ba-19d2e853f14b', '0241e68a-9b21-5658-bcd4-55cfa515d63c',
        'e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', 'Acima de 60 °C a leitura desvia — não é preferência, é que o acoplante seca e a velocidade do som no aço muda com a temperatura. Se não der para esperar a parada, use sonda de alta temperatura e aplique a correção da tabela. Sem isso, a espessura sai menor do que é e você programa reparo que não precisa.',
        true, '2026-08-10T10:40:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('50a2db74-dd97-56ef-866e-bee4bef26328', '04a9e4b1-e038-5d53-8340-bae65cb8b45e', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc',
        NULL, 'Fiquei na dúvida entre corrosão interna e externa no exemplo do minuto 9. Pite sob depósito na parede de baixo da linha entra em qual das duas?',
        false, '2026-08-11T09:05:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', '04a9e4b1-e038-5d53-8340-bae65cb8b45e', '0241e68a-9b21-5658-bcd4-55cfa515d63c',
        '50a2db74-dd97-56ef-866e-bee4bef26328', 'Interna. O ataque vem do fluido que passa dentro, e a água livre decanta justamente na geratriz de baixo — por isso o pite aparece ali. Externa é a que vem de fora: solo, umidade sob isolamento, corrente de interferência. A separação importa porque a defesa é diferente: uma se resolve com inibidor e pigagem, a outra com revestimento e proteção catódica.',
        true, '2026-08-11T11:22:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;

INSERT INTO tracks (id, tenant_id, org_unit_id, slug, title, summary, mode, project)
VALUES ('4643cda7-bb07-5487-9c63-8b3e6f03849c', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        'operacao-de-campo', 'Operação de Campo',
        'Do reservatório ao ponto de entrega: a formação completa de quem opera os campos.', 'sequential', NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, mode = EXCLUDED.mode;
INSERT INTO track_courses (track_id, course_id, position)
VALUES ('4643cda7-bb07-5487-9c63-8b3e6f03849c', 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 1)
ON CONFLICT (track_id, course_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO track_courses (track_id, course_id, position)
VALUES ('4643cda7-bb07-5487-9c63-8b3e6f03849c', '8145bed3-edf2-55a1-836a-392900cd3d7e', 2)
ON CONFLICT (track_id, course_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO track_courses (track_id, course_id, position)
VALUES ('4643cda7-bb07-5487-9c63-8b3e6f03849c', '65c85afb-fd59-575d-8754-15fee87d6589', 3)
ON CONFLICT (track_id, course_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO tracks (id, tenant_id, org_unit_id, slug, title, summary, mode, project)
VALUES ('dd46023b-ff2a-55b6-b94f-36452e2a6552', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        'atendimento-e-comunidade', 'Comunidade e Território',
        'Como falar com quem é afetado pela operação, do primeiro contato à prestação de contas.', 'free', NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, mode = EXCLUDED.mode;
INSERT INTO track_courses (track_id, course_id, position)
VALUES ('dd46023b-ff2a-55b6-b94f-36452e2a6552', '24c2669e-c4de-5632-81fb-6e761cc86d3f', 1)
ON CONFLICT (track_id, course_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO track_courses (track_id, course_id, position)
VALUES ('dd46023b-ff2a-55b6-b94f-36452e2a6552', '8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', 2)
ON CONFLICT (track_id, course_id) DO UPDATE SET position = EXCLUDED.position;

INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('7a9dbf21-36ed-5020-a33e-ef95a87f1369', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('7a9dbf21-36ed-5020-a33e-ef95a87f1369', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('b8a8acb7-d04e-55c0-ac9b-10018845d91e', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('b8a8acb7-d04e-55c0-ac9b-10018845d91e', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('b8a8acb7-d04e-55c0-ac9b-10018845d91e', 'cde71ffa-eb22-541b-af5f-88f1b9bec629')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('b8a8acb7-d04e-55c0-ac9b-10018845d91e', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('06302eca-6b79-53fc-b4a6-3b4065a894a3', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('06302eca-6b79-53fc-b4a6-3b4065a894a3', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('06302eca-6b79-53fc-b4a6-3b4065a894a3', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('06302eca-6b79-53fc-b4a6-3b4065a894a3', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('06302eca-6b79-53fc-b4a6-3b4065a894a3', 'd958b9da-9f14-57db-ac67-8cd7fc77c167')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('06302eca-6b79-53fc-b4a6-3b4065a894a3', 'ae870e0b-ede4-51ef-8f59-05172aa84a08')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('06302eca-6b79-53fc-b4a6-3b4065a894a3', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('06302eca-6b79-53fc-b4a6-3b4065a894a3', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', 'cde71ffa-eb22-541b-af5f-88f1b9bec629')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', 'd958b9da-9f14-57db-ac67-8cd7fc77c167')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', 'ae870e0b-ede4-51ef-8f59-05172aa84a08')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('d61103aa-762f-55b1-8de9-f49db19c829d', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('7a7092c6-00cf-5780-a18d-208b78278ede', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('7a7092c6-00cf-5780-a18d-208b78278ede', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('7a7092c6-00cf-5780-a18d-208b78278ede', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('7a7092c6-00cf-5780-a18d-208b78278ede', 'cde71ffa-eb22-541b-af5f-88f1b9bec629')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('454419ad-5ffe-5e68-af8e-af966bc3d31d', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('454419ad-5ffe-5e68-af8e-af966bc3d31d', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('454419ad-5ffe-5e68-af8e-af966bc3d31d', 'cde71ffa-eb22-541b-af5f-88f1b9bec629')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('454419ad-5ffe-5e68-af8e-af966bc3d31d', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('454419ad-5ffe-5e68-af8e-af966bc3d31d', 'd958b9da-9f14-57db-ac67-8cd7fc77c167')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', 'cde71ffa-eb22-541b-af5f-88f1b9bec629')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', 'd958b9da-9f14-57db-ac67-8cd7fc77c167')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', 'ae870e0b-ede4-51ef-8f59-05172aa84a08')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e9bc7804-d79c-5d24-81ad-016487ce769f', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('dd5b233e-55e8-54eb-8637-7346836bd80d', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('dd5b233e-55e8-54eb-8637-7346836bd80d', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', 'cde71ffa-eb22-541b-af5f-88f1b9bec629')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', 'd958b9da-9f14-57db-ac67-8cd7fc77c167')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', 'ae870e0b-ede4-51ef-8f59-05172aa84a08')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', 'cde71ffa-eb22-541b-af5f-88f1b9bec629')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', 'd958b9da-9f14-57db-ac67-8cd7fc77c167')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', 'ae870e0b-ede4-51ef-8f59-05172aa84a08')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('50a2db74-dd97-56ef-866e-bee4bef26328', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('50a2db74-dd97-56ef-866e-bee4bef26328', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('50a2db74-dd97-56ef-866e-bee4bef26328', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('50a2db74-dd97-56ef-866e-bee4bef26328', 'cde71ffa-eb22-541b-af5f-88f1b9bec629')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', '26757df8-30c8-5c63-805a-197a8d9593db')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', 'cde71ffa-eb22-541b-af5f-88f1b9bec629')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', 'd958b9da-9f14-57db-ac67-8cd7fc77c167')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', 'ae870e0b-ede4-51ef-8f59-05172aa84a08')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9')
ON CONFLICT DO NOTHING;
INSERT INTO comment_votes (comment_id, voter_id)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573')
ON CONFLICT DO NOTHING;

INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('3f378a67-0a42-5f25-b9ea-a75823c356ec', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        GREATEST(date_trunc('month', current_date)::date,
                 LEAST((current_date + interval '-10 days')::date,
                       (date_trunc('month', current_date) + interval '1 month - 1 day')::date)), NULL,
        'Prazo: Segurança em Operações de Campo', 'deadline', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('54cc9ac2-ff8b-5543-931e-9ddcca7c3814', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        GREATEST(date_trunc('month', current_date)::date,
                 LEAST((current_date + interval '-5 days')::date,
                       (date_trunc('month', current_date) + interval '1 month - 1 day')::date)), '14h às 17h',
        'Treinamento ao vivo: Bombeio mecânico', 'training', 'Estação Unidade Central', NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('fa24a185-6d1f-52a3-bf75-59d3a44e262a', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        GREATEST(date_trunc('month', current_date)::date,
                 LEAST((current_date)::date,
                       (date_trunc('month', current_date) + interval '1 month - 1 day')::date)), NULL,
        'Comunicado: nova norma de integridade', 'announcement', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('969781a7-e3c7-5225-9b27-878dc325a706', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        GREATEST(date_trunc('month', current_date)::date,
                 LEAST((current_date + interval '2 days')::date,
                       (date_trunc('month', current_date) + interval '1 month - 1 day')::date)), '9h às 12h',
        'Treinamento ao vivo: Integração', 'training', 'Online', NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('8bd3c98c-c744-5006-ad7d-f94857329654', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        GREATEST(date_trunc('month', current_date)::date,
                 LEAST((current_date + interval '4 days')::date,
                       (date_trunc('month', current_date) + interval '1 month - 1 day')::date)), NULL,
        'Prazo: Relacionamento com Comunidades', 'deadline', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('55b31513-71e2-5756-9553-57e72a36bdf8', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL,
        GREATEST(date_trunc('month', current_date)::date,
                 LEAST((current_date + interval '5 days')::date,
                       (date_trunc('month', current_date) + interval '1 month - 1 day')::date)), NULL,
        'Semana da Segurança', 'announcement', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;

INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('7dc5e22a-e8e4-51c4-9d38-e02d77769f87', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL, '/cursos/seguranca-em-operacoes-de-campo')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('b22f7de1-15f5-5a5f-a258-4b8377a40cc7', '26757df8-30c8-5c63-805a-197a8d9593db', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL, '/cursos/seguranca-em-operacoes-de-campo')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('08a0704e-1a44-53b4-90e9-cfdd7fa09293', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL, '/cursos/seguranca-em-operacoes-de-campo')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('7adad3c7-30b2-58af-b681-8942b7f8749c', 'cde71ffa-eb22-541b-af5f-88f1b9bec629', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL, '/cursos/seguranca-em-operacoes-de-campo')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('5f5ec1b5-d93e-58e7-9a2e-2b33d9db899e', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL, '/cursos/seguranca-em-operacoes-de-campo')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('f54bd80c-8aad-59bc-a3fd-1d75ecda4470', 'd958b9da-9f14-57db-ac67-8cd7fc77c167', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL, '/cursos/seguranca-em-operacoes-de-campo')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('7163ecb1-76f4-515c-9623-d929aec7bd6c', 'ae870e0b-ede4-51ef-8f59-05172aa84a08', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL, '/cursos/seguranca-em-operacoes-de-campo')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('28c69d83-cf69-5066-81bc-a44a5b01caed', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL, '/cursos/seguranca-em-operacoes-de-campo')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('a5a74cf8-df92-5f06-a6cd-aa8cc89e4166', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL, '/cursos/seguranca-em-operacoes-de-campo')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('d934363f-f192-5e99-bce0-55bfe5084598', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', 'Novo comunicado do RH',
        'A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL, '/agenda')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('2d39ef45-3696-5689-89eb-43df43ec9699', '26757df8-30c8-5c63-805a-197a8d9593db', 'Novo comunicado do RH',
        'A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL, '/agenda')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('875347c4-0bf8-5499-908b-388e650ddec8', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65', 'Novo comunicado do RH',
        'A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL, '/agenda')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('abd86d87-cb71-52a7-8d02-0ea965c5b76d', 'cde71ffa-eb22-541b-af5f-88f1b9bec629', 'Novo comunicado do RH',
        'A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL, '/agenda')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('0159070d-4ab4-52f4-90ab-122f59412550', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc', 'Novo comunicado do RH',
        'A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL, '/agenda')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('a7b4fca3-9c89-51f7-8309-82bf387c7bd0', 'd958b9da-9f14-57db-ac67-8cd7fc77c167', 'Novo comunicado do RH',
        'A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL, '/agenda')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('58f7a308-7f77-52b7-b8a3-4fa379617976', 'ae870e0b-ede4-51ef-8f59-05172aa84a08', 'Novo comunicado do RH',
        'A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL, '/agenda')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('3d4099f3-ca4e-5036-b00f-d2a476e5ec2d', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', 'Novo comunicado do RH',
        'A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL, '/agenda')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('4bcf2948-8f3e-52b0-9695-d1125102ef27', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', 'Novo comunicado do RH',
        'A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL, '/agenda')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('2d19f4b2-fc02-5896-8487-d8cba0718984', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days', '/perfil')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('a11ac871-af74-545a-b0d9-681709a2b1f6', '26757df8-30c8-5c63-805a-197a8d9593db', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days', '/perfil')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('e8e7b5c3-5884-5012-8d8b-0075cd18e048', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days', '/perfil')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('16218cf0-88a7-50b8-b426-1bd284181926', 'cde71ffa-eb22-541b-af5f-88f1b9bec629', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days', '/perfil')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('918dc2cd-d7e0-5cd1-b07b-145c24ee9ef6', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days', '/perfil')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('1ae0abcc-8b90-53de-912f-76031b18ca19', 'd958b9da-9f14-57db-ac67-8cd7fc77c167', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days', '/perfil')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('84f8d9d7-2366-505e-a4e0-21d9a5287358', 'ae870e0b-ede4-51ef-8f59-05172aa84a08', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days', '/perfil')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('534302df-16ae-5fdd-aa87-09d26f6e5529', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days', '/perfil')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('57c6c8db-0a1d-5c07-a14a-554bb451fc19', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days', '/perfil')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('cf4ae772-7f78-531f-92d2-60f091a458f9', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', 'Instrutor respondeu seu comentário',
        'Em Coleta e separação · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days', '/cursos/operacao-de-pocos-fundamentos')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('5e6226ab-b55b-5e61-b96a-cc25319b55f1', '26757df8-30c8-5c63-805a-197a8d9593db', 'Instrutor respondeu seu comentário',
        'Em Coleta e separação · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days', '/cursos/operacao-de-pocos-fundamentos')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('2339d598-6b23-57db-a02b-e8665b80babd', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65', 'Instrutor respondeu seu comentário',
        'Em Coleta e separação · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days', '/cursos/operacao-de-pocos-fundamentos')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('01f188f2-5a3f-5d76-86f9-addbbc11376d', 'cde71ffa-eb22-541b-af5f-88f1b9bec629', 'Instrutor respondeu seu comentário',
        'Em Coleta e separação · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days', '/cursos/operacao-de-pocos-fundamentos')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('5ccab087-03ae-5549-9455-155c4f78162e', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc', 'Instrutor respondeu seu comentário',
        'Em Coleta e separação · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days', '/cursos/operacao-de-pocos-fundamentos')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('5372ba1e-30c4-56ca-965e-74ed0efd6d47', 'd958b9da-9f14-57db-ac67-8cd7fc77c167', 'Instrutor respondeu seu comentário',
        'Em Coleta e separação · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days', '/cursos/operacao-de-pocos-fundamentos')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('adb6a3e0-debf-501b-b34f-888dadcc3cc5', 'ae870e0b-ede4-51ef-8f59-05172aa84a08', 'Instrutor respondeu seu comentário',
        'Em Coleta e separação · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days', '/cursos/operacao-de-pocos-fundamentos')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('23e12986-aab1-5982-8862-298084e7b4c7', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', 'Instrutor respondeu seu comentário',
        'Em Coleta e separação · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days', '/cursos/operacao-de-pocos-fundamentos')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at, link)
VALUES ('9f435228-c90d-55e3-bf21-2353d202d305', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', 'Instrutor respondeu seu comentário',
        'Em Coleta e separação · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days', '/cursos/operacao-de-pocos-fundamentos')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at,
  link = EXCLUDED.link;

-- ------------------------------------------------------------------ provas
-- Uma por curso, com as questões e as alternativas. O conteúdo vem de
-- `apps/frontend/src/mocks/quizzes.ts`.
--
-- `min_grade_percent` do curso é acertado junto: sem ele, concluir as aulas
-- bastaria para o certificado e a prova viraria enfeite. É a exigência que
-- transforma a nota em consequência.

INSERT INTO quizzes (id, tenant_id, course_id, lesson_id, title, description,
                     time_limit_minutes, max_attempts, passing_score, grading_method,
                     shuffle_questions, shuffle_options, questions_per_page,
                     sequential_navigation, feedback_mode)
VALUES ('b2ff4210-6403-5262-a5c7-ec493e3defd3', (SELECT id FROM tenants WHERE slug = 'exemplo'), 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', NULL, 'Avaliação final — Operação de Poços', 'Quatro questões sobre reservatório, elevação artificial e medição.',
        30, 3, 70, 'best',
        false, true, 1, false, 'on_submit')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  passing_score = EXCLUDED.passing_score, max_attempts = EXCLUDED.max_attempts,
  time_limit_minutes = EXCLUDED.time_limit_minutes;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('a4dc5b5e-7845-5e61-805b-78dc2ff0068c', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'single_choice', 'O que caracteriza a elevação artificial num poço de petróleo?',
        1, 'Quando a pressão natural deixa de vencer a coluna hidrostática, é preciso energia de fora — bombeio mecânico, BCP, BCS ou gas lift.', NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('60185265-4458-58a3-ba75-63b5bce615b4', 'a4dc5b5e-7845-5e61-805b-78dc2ff0068c', 'O uso de energia externa para trazer o fluido à superfície quando a pressão do reservatório não basta',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('9e08f476-de2d-595d-bcca-575b7830300f', 'a4dc5b5e-7845-5e61-805b-78dc2ff0068c', 'A perfuração de um poço adicional para aumentar a vazão',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('6ab608a0-9c97-560e-981d-cc77781d63c3', 'a4dc5b5e-7845-5e61-805b-78dc2ff0068c', 'O aquecimento do óleo dentro do reservatório',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('5c0d41a9-b065-5da2-b472-7d85e0752dec', 'a4dc5b5e-7845-5e61-805b-78dc2ff0068c', 'A separação de gás e água ainda no fundo do poço',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('b2ff4210-6403-5262-a5c7-ec493e3defd3', 'a4dc5b5e-7845-5e61-805b-78dc2ff0068c', 1, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('36d6f633-bc63-5b4b-8a32-f049c060a30e', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'single_choice', 'Num sistema de bombeio mecânico, qual componente converte o movimento rotativo em alternado?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('db50ef1e-1e4c-53c5-95b3-6fa60d7071c1', '36d6f633-bc63-5b4b-8a32-f049c060a30e', 'A unidade de bombeio, pela manivela e pela biela',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('0b497857-9b46-5b6b-9053-b7e72ed2c1d2', '36d6f633-bc63-5b4b-8a32-f049c060a30e', 'A bomba de fundo',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('6232e43c-6bf0-5bf6-b55a-03cce2cc156e', '36d6f633-bc63-5b4b-8a32-f049c060a30e', 'A coluna de hastes',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('39cab02b-1a4f-5bf6-ac25-75f60811b0b2', '36d6f633-bc63-5b4b-8a32-f049c060a30e', 'O revestimento de produção',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('b2ff4210-6403-5262-a5c7-ec493e3defd3', '36d6f633-bc63-5b4b-8a32-f049c060a30e', 2, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('bb5b186c-14da-5a59-953c-7a71f06a5385', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'single_choice', 'Qual é a função do separador na estação coletora?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('5abb53bc-f2af-5b52-a68e-bd4ecd1df50c', 'bb5b186c-14da-5a59-953c-7a71f06a5385', 'Separar as fases óleo, gás e água que chegam misturadas do poço',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('2c6a157c-95d7-5421-a34b-41f12224973a', 'bb5b186c-14da-5a59-953c-7a71f06a5385', 'Elevar a pressão do gás para o transporte',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('98056bcf-996c-51ca-ad8e-dbeceefb5c18', 'bb5b186c-14da-5a59-953c-7a71f06a5385', 'Medir a vazão de cada poço individualmente',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('d2d9a500-c03c-5a82-a34e-b56f7674eea2', 'bb5b186c-14da-5a59-953c-7a71f06a5385', 'Remover sedimentos do revestimento',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('b2ff4210-6403-5262-a5c7-ec493e3defd3', 'bb5b186c-14da-5a59-953c-7a71f06a5385', 3, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('5185a174-d9e1-5b16-bc7e-528871b4c204', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'single_choice', 'Por que a medição fiscal exige rastreabilidade metrológica?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('ad2d3963-7f8b-5fce-9cbb-353a9fbc04d3', '5185a174-d9e1-5b16-bc7e-528871b4c204', 'Porque o volume medido define tributos e a partilha entre os envolvidos',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('a3f468b7-e3c1-542b-add5-d069f8a5c250', '5185a174-d9e1-5b16-bc7e-528871b4c204', 'Porque a ANP exige que o medidor seja importado',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('86c7a2bb-e011-59b5-8921-00b064de6f6c', '5185a174-d9e1-5b16-bc7e-528871b4c204', 'Porque a medição substitui o teste de produção',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('e1e2adc3-efbe-50f8-bc06-ea59e3114698', '5185a174-d9e1-5b16-bc7e-528871b4c204', 'Porque o medidor precisa operar sem energia elétrica',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('b2ff4210-6403-5262-a5c7-ec493e3defd3', '5185a174-d9e1-5b16-bc7e-528871b4c204', 4, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
UPDATE courses SET min_grade_percent = 70 WHERE id = 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c';

INSERT INTO quizzes (id, tenant_id, course_id, lesson_id, title, description,
                     time_limit_minutes, max_attempts, passing_score, grading_method,
                     shuffle_questions, shuffle_options, questions_per_page,
                     sequential_navigation, feedback_mode)
VALUES ('09d554a9-d44f-5cfb-a353-21638347ed11', (SELECT id FROM tenants WHERE slug = 'exemplo'), '8145bed3-edf2-55a1-836a-392900cd3d7e', NULL, 'Avaliação final — Integridade de Ativos', 'Quatro questões sobre mecanismos de corrosão, inspeção e mitigação.',
        30, 3, 70, 'best',
        false, true, 1, false, 'on_submit')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  passing_score = EXCLUDED.passing_score, max_attempts = EXCLUDED.max_attempts,
  time_limit_minutes = EXCLUDED.time_limit_minutes;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('d709b22d-3bd6-5456-aef8-1a82f025b2b5', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '8145bed3-edf2-55a1-836a-392900cd3d7e', 'single_choice', 'O que é corrosão sob isolamento (CUI)?',
        1, 'É perigosa porque a inspeção visual externa não a revela: o isolamento esconde o dano até a falha.', NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('8a502f35-eea3-54db-b7c6-b11b9b78a471', 'd709b22d-3bd6-5456-aef8-1a82f025b2b5', 'A corrosão que ocorre sob o material isolante, alimentada por água retida e difícil de ver por fora',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('4a51a307-d36e-5e41-bec7-a94c136957e0', 'd709b22d-3bd6-5456-aef8-1a82f025b2b5', 'A corrosão causada pelo próprio material isolante reagir com o aço',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('ae572a84-a5ec-5cc8-b199-0d264a8796e9', 'd709b22d-3bd6-5456-aef8-1a82f025b2b5', 'A corrosão que só acontece em linhas enterradas',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('ad343cca-f887-5084-b244-c1df8a98ddbb', 'd709b22d-3bd6-5456-aef8-1a82f025b2b5', 'Um tipo de corrosão exclusivo de tanques de teto flutuante',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('09d554a9-d44f-5cfb-a353-21638347ed11', 'd709b22d-3bd6-5456-aef8-1a82f025b2b5', 1, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('843f845e-a7bf-5480-a6d5-82358e6c6c56', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '8145bed3-edf2-55a1-836a-392900cd3d7e', 'single_choice', 'Qual técnica de inspeção mede a espessura remanescente de parede sem cortar o equipamento?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('af40e66b-2950-537d-a9f5-43fb5500e96a', '843f845e-a7bf-5480-a6d5-82358e6c6c56', 'Ultrassom',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('45b6d3ee-d92b-5a00-9a00-e04e29e6ff70', '843f845e-a7bf-5480-a6d5-82358e6c6c56', 'Líquido penetrante',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('f3816bf4-e2d7-5d7d-88b8-d65cbf06122c', '843f845e-a7bf-5480-a6d5-82358e6c6c56', 'Inspeção visual direta',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('bf4ff779-be5a-58a6-add0-0bd956e0fb3b', '843f845e-a7bf-5480-a6d5-82358e6c6c56', 'Ensaio de dureza',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('09d554a9-d44f-5cfb-a353-21638347ed11', '843f845e-a7bf-5480-a6d5-82358e6c6c56', 2, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('3e7252b6-7fb4-5e7c-b5b9-4ebd3f007d73', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '8145bed3-edf2-55a1-836a-392900cd3d7e', 'single_choice', 'Para que serve a proteção catódica numa tubulação enterrada?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('dbfc8c97-9deb-56f0-a55b-cafdea608682', '3e7252b6-7fb4-5e7c-b5b9-4ebd3f007d73', 'Tornar a tubulação catodo de uma célula eletroquímica, deslocando a corrosão para um anodo de sacrifício',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('7ac42130-0b1b-5cc7-8b90-4244e55f7585', '3e7252b6-7fb4-5e7c-b5b9-4ebd3f007d73', 'Criar uma barreira física entre o metal e o solo',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('cee010c5-1d2d-5818-baf2-8f7ee69f5705', '3e7252b6-7fb4-5e7c-b5b9-4ebd3f007d73', 'Elevar a temperatura da linha e evaporar a umidade',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('3548aa9d-8e35-5d39-9762-4c5c6353b56c', '3e7252b6-7fb4-5e7c-b5b9-4ebd3f007d73', 'Neutralizar quimicamente o H2S do fluido',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('09d554a9-d44f-5cfb-a353-21638347ed11', '3e7252b6-7fb4-5e7c-b5b9-4ebd3f007d73', 3, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('031ab0fb-93e2-50ef-b2d6-908588c02e6c', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '8145bed3-edf2-55a1-836a-392900cd3d7e', 'single_choice', 'O que a taxa de corrosão permite calcular?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('ba5904e2-861f-549b-855f-3e6fb75eabb3', '031ab0fb-93e2-50ef-b2d6-908588c02e6c', 'A vida remanescente do equipamento e o intervalo até a próxima inspeção',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('bafb1a85-dcf0-57a4-804d-326c463d3cd0', '031ab0fb-93e2-50ef-b2d6-908588c02e6c', 'A pressão máxima de operação do equipamento',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('3f4210e8-e3cf-5134-b11d-664409e0ba4e', '031ab0fb-93e2-50ef-b2d6-908588c02e6c', 'O custo de reposição do ativo',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('12a2ed97-1649-55a1-b59d-6266260c20f6', '031ab0fb-93e2-50ef-b2d6-908588c02e6c', 'A composição química do fluido transportado',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('09d554a9-d44f-5cfb-a353-21638347ed11', '031ab0fb-93e2-50ef-b2d6-908588c02e6c', 4, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
UPDATE courses SET min_grade_percent = 70 WHERE id = '8145bed3-edf2-55a1-836a-392900cd3d7e';

INSERT INTO quizzes (id, tenant_id, course_id, lesson_id, title, description,
                     time_limit_minutes, max_attempts, passing_score, grading_method,
                     shuffle_questions, shuffle_options, questions_per_page,
                     sequential_navigation, feedback_mode)
VALUES ('b9686853-e423-509e-952c-f183faa8c40a', (SELECT id FROM tenants WHERE slug = 'exemplo'), '57cfcb32-8049-5ba4-9c92-45351df8de19', NULL, 'Avaliação final — Segurança em Operações de Campo', 'Quatro questões sobre permissão de trabalho, espaço confinado e trabalho a quente.',
        30, 3, 80, 'best',
        false, true, 1, false, 'on_submit')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  passing_score = EXCLUDED.passing_score, max_attempts = EXCLUDED.max_attempts,
  time_limit_minutes = EXCLUDED.time_limit_minutes;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('31b7cd78-f880-58d3-8502-341bfd32f729', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '57cfcb32-8049-5ba4-9c92-45351df8de19', 'single_choice', 'Qual é a finalidade da Permissão de Trabalho (PT)?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('f4c54acd-0099-5443-ae08-35232c58b5a0', '31b7cd78-f880-58d3-8502-341bfd32f729', 'Garantir que os riscos foram avaliados e as medidas de controle estão em vigor antes de a tarefa começar',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('ea6826d5-a45a-5009-8fa3-a4f7e3f07ac7', '31b7cd78-f880-58d3-8502-341bfd32f729', 'Registrar as horas trabalhadas pela equipe',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('d75cbb00-51a3-5397-b8c6-e1320cb461f4', '31b7cd78-f880-58d3-8502-341bfd32f729', 'Substituir a análise preliminar de risco',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('507dac72-e56d-5060-99e4-777b0a7a1e89', '31b7cd78-f880-58d3-8502-341bfd32f729', 'Autorizar o acesso à área administrativa',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('b9686853-e423-509e-952c-f183faa8c40a', '31b7cd78-f880-58d3-8502-341bfd32f729', 1, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('2686929b-ae00-5a1f-9777-405bf47f5c87', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '57cfcb32-8049-5ba4-9c92-45351df8de19', 'single_choice', 'Antes de entrar num espaço confinado, o que deve ser feito obrigatoriamente?',
        1, 'A atmosfera muda: a medição é contínua, não uma vez só. E o vigia não entra — quem entra para socorrer sem preparo vira a segunda vítima.', NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('2343977a-5d21-5ae4-84c0-655e274d3c1d', '2686929b-ae00-5a1f-9777-405bf47f5c87', 'Medir a atmosfera — oxigênio, gases inflamáveis e tóxicos — e manter vigia do lado de fora',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('b20b0bdc-9ce2-53ea-99c9-bc7ae0ba6f89', '2686929b-ae00-5a1f-9777-405bf47f5c87', 'Aguardar trinta minutos após abrir a escotilha',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('07000df2-2e03-545e-9f6d-b23b7641e3fe', '2686929b-ae00-5a1f-9777-405bf47f5c87', 'Entrar com dois trabalhadores para agilizar',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('5d431570-d265-5c20-9a03-d54b179b4005', '2686929b-ae00-5a1f-9777-405bf47f5c87', 'Desligar o rádio para evitar faísca',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('b9686853-e423-509e-952c-f183faa8c40a', '2686929b-ae00-5a1f-9777-405bf47f5c87', 2, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('9ae6567c-8889-5e6b-ac1d-5ec072873a7f', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '57cfcb32-8049-5ba4-9c92-45351df8de19', 'single_choice', 'O que caracteriza um trabalho a quente?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('20c21949-a616-5d50-9cf1-abf17a4994eb', '9ae6567c-8889-5e6b-ac1d-5ec072873a7f', 'Qualquer atividade que gere chama, faísca ou calor capaz de inflamar uma atmosfera',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('b119b44f-4c25-5e54-a29e-9a8a2d4c0e30', '9ae6567c-8889-5e6b-ac1d-5ec072873a7f', 'Qualquer trabalho realizado acima de 30 °C',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('fa490975-e0a3-5c36-9f5e-59b03d7cab12', '9ae6567c-8889-5e6b-ac1d-5ec072873a7f', 'Apenas soldagem elétrica',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('6cceb59d-1e25-55fa-8c71-5a821d55dab2', '9ae6567c-8889-5e6b-ac1d-5ec072873a7f', 'Trabalho executado no turno da tarde',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('b9686853-e423-509e-952c-f183faa8c40a', '9ae6567c-8889-5e6b-ac1d-5ec072873a7f', 3, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('66165804-f301-5cee-8645-cfb8e67ed70c', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '57cfcb32-8049-5ba4-9c92-45351df8de19', 'single_choice', 'Numa situação de risco iminente, qual é o dever de quem observa?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('8f948c8e-2018-5d23-921e-666e112c5e7e', '66165804-f301-5cee-8645-cfb8e67ed70c', 'Interromper a atividade imediatamente — a recusa ao trabalho inseguro é um direito e um dever',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('332c82e0-f826-539c-aee1-2c5aabd01bb6', '66165804-f301-5cee-8645-cfb8e67ed70c', 'Registrar no relatório de fim de turno',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('2584fda9-838d-5d75-af96-d92a751828f5', '66165804-f301-5cee-8645-cfb8e67ed70c', 'Aguardar a chegada do supervisor para decidir',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('1f5bf4c7-62ae-5c99-b2ae-354f4ec9a834', '66165804-f301-5cee-8645-cfb8e67ed70c', 'Continuar e comunicar depois, para não parar a operação',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('b9686853-e423-509e-952c-f183faa8c40a', '66165804-f301-5cee-8645-cfb8e67ed70c', 4, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
UPDATE courses SET min_grade_percent = 80 WHERE id = '57cfcb32-8049-5ba4-9c92-45351df8de19';

INSERT INTO quizzes (id, tenant_id, course_id, lesson_id, title, description,
                     time_limit_minutes, max_attempts, passing_score, grading_method,
                     shuffle_questions, shuffle_options, questions_per_page,
                     sequential_navigation, feedback_mode)
VALUES ('9bd40fb8-9742-58d0-a84b-eb864c146f39', (SELECT id FROM tenants WHERE slug = 'exemplo'), '24c2669e-c4de-5632-81fb-6e761cc86d3f', NULL, 'Avaliação final — Relacionamento com Comunidades', 'Quatro questões sobre diálogo, impacto e canais de atendimento.',
        25, 3, 70, 'best',
        false, true, 1, false, 'on_submit')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  passing_score = EXCLUDED.passing_score, max_attempts = EXCLUDED.max_attempts,
  time_limit_minutes = EXCLUDED.time_limit_minutes;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('951cd7ec-469a-560b-aefb-6c75c83ff3b3', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'single_choice', 'O que é uma parte interessada (stakeholder) num projeto de operação onshore?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('c0253622-74ae-5b3b-9e2d-1839b69425dc', '951cd7ec-469a-560b-aefb-6c75c83ff3b3', 'Qualquer pessoa ou grupo afetado pela operação ou capaz de afetá-la',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('039dc5fa-b830-5895-bb79-ee1b6e1621cd', '951cd7ec-469a-560b-aefb-6c75c83ff3b3', 'Somente os proprietários das terras onde há poços',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('eeab214f-34ff-5f7b-83e9-420bb6c62726', '951cd7ec-469a-560b-aefb-6c75c83ff3b3', 'Somente os órgãos ambientais licenciadores',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('57a2019d-1018-5c94-aafb-3910c398346b', '951cd7ec-469a-560b-aefb-6c75c83ff3b3', 'Somente os empregados diretos da companhia',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('9bd40fb8-9742-58d0-a84b-eb864c146f39', '951cd7ec-469a-560b-aefb-6c75c83ff3b3', 1, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('dca95fbe-f188-5ba0-8fe1-f894708dbea5', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'single_choice', 'Por que registrar formalmente as manifestações da comunidade?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('7810cc2b-2aae-5ae7-99de-ec10576a8b08', 'dca95fbe-f188-5ba0-8fe1-f894708dbea5', 'Porque o registro cria rastreabilidade e permite responder, acompanhar e demonstrar tratamento',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('46b999ea-0ff5-5640-9563-0b4b22ed15b4', 'dca95fbe-f188-5ba0-8fe1-f894708dbea5', 'Porque a legislação proíbe atendimento verbal',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('eabca2b5-d6d6-517d-a08a-26004fc98fb8', 'dca95fbe-f188-5ba0-8fe1-f894708dbea5', 'Porque o registro substitui a resposta ao manifestante',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('29faac23-e72b-5d13-8f9c-e20e668fe002', 'dca95fbe-f188-5ba0-8fe1-f894708dbea5', 'Porque só manifestações escritas têm validade',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('9bd40fb8-9742-58d0-a84b-eb864c146f39', 'dca95fbe-f188-5ba0-8fe1-f894708dbea5', 2, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('fe9359e0-7f21-57de-8d2e-5bb7184d32d8', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'single_choice', 'Qual postura é adequada diante de uma reclamação sobre ruído noturno de uma sonda?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('a0f8f0dd-91a8-5854-8199-8503445372fd', 'fe9359e0-7f21-57de-8d2e-5bb7184d32d8', 'Ouvir, registrar, verificar em campo e retornar com o que foi apurado e o prazo de tratativa',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('ddb81837-5997-51c7-a679-2dfebd5cdc3e', 'fe9359e0-7f21-57de-8d2e-5bb7184d32d8', 'Explicar que o ruído está dentro da norma e encerrar o assunto',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('76a39262-b39c-5d1e-a1d3-792b3fed21a1', 'fe9359e0-7f21-57de-8d2e-5bb7184d32d8', 'Encaminhar ao jurídico sem responder ao morador',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('8b13e780-6f06-5855-8f5a-a02121fb6cdc', 'fe9359e0-7f21-57de-8d2e-5bb7184d32d8', 'Aguardar novas reclamações para confirmar o problema',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('9bd40fb8-9742-58d0-a84b-eb864c146f39', 'fe9359e0-7f21-57de-8d2e-5bb7184d32d8', 3, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('8cda6c70-01e0-5a59-96e9-a4cd89aa2b2f', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'single_choice', 'O que diferencia comunicação de engajamento comunitário?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('89f56d3c-694a-511f-b4e3-e59e597b7541', '8cda6c70-01e0-5a59-96e9-a4cd89aa2b2f', 'Comunicação informa; engajamento envolve a comunidade na construção das decisões que a afetam',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('7b6f9592-dbd5-5482-8f61-cf8a6ba7dab9', '8cda6c70-01e0-5a59-96e9-a4cd89aa2b2f', 'Comunicação é escrita; engajamento é presencial',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('68698412-b4fe-5c3c-b317-cad7ff0a8bd8', '8cda6c70-01e0-5a59-96e9-a4cd89aa2b2f', 'Comunicação é da empresa; engajamento é do órgão ambiental',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('d7a88038-1e4b-5350-841e-66cfd4af14c9', '8cda6c70-01e0-5a59-96e9-a4cd89aa2b2f', 'Não há diferença prática entre os dois',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('9bd40fb8-9742-58d0-a84b-eb864c146f39', '8cda6c70-01e0-5a59-96e9-a4cd89aa2b2f', 4, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
UPDATE courses SET min_grade_percent = 70 WHERE id = '24c2669e-c4de-5632-81fb-6e761cc86d3f';

INSERT INTO quizzes (id, tenant_id, course_id, lesson_id, title, description,
                     time_limit_minutes, max_attempts, passing_score, grading_method,
                     shuffle_questions, shuffle_options, questions_per_page,
                     sequential_navigation, feedback_mode)
VALUES ('43de7b99-f1f1-5e5d-ab4d-5927fcf677bf', (SELECT id FROM tenants WHERE slug = 'exemplo'), 'c7027595-6095-521c-9087-8a2cb3efba5b', NULL, 'Avaliação final — Meio Ambiente e Licenciamento', 'Quatro questões sobre licenças, condicionantes e resposta a incidentes.',
        25, 3, 70, 'best',
        false, true, 1, false, 'on_submit')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  passing_score = EXCLUDED.passing_score, max_attempts = EXCLUDED.max_attempts,
  time_limit_minutes = EXCLUDED.time_limit_minutes;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('a57d2655-baa8-5f74-9972-5331163bbf28', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, 'c7027595-6095-521c-9087-8a2cb3efba5b', 'single_choice', 'Qual licença autoriza o início da operação de uma instalação já construída?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('6fbf4ca1-6abf-5f39-87bd-abd460ee6cbc', 'a57d2655-baa8-5f74-9972-5331163bbf28', 'Licença de Operação (LO)',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('9595bad6-a3f5-5256-a52a-f74b60cf51cf', 'a57d2655-baa8-5f74-9972-5331163bbf28', 'Licença Prévia (LP)',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('86a61dd9-4839-5a08-a197-a274e56334db', 'a57d2655-baa8-5f74-9972-5331163bbf28', 'Licença de Instalação (LI)',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('d628de9b-59cc-559c-a177-dc171a126033', 'a57d2655-baa8-5f74-9972-5331163bbf28', 'Autorização de Supressão Vegetal',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('43de7b99-f1f1-5e5d-ab4d-5927fcf677bf', 'a57d2655-baa8-5f74-9972-5331163bbf28', 1, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('8bf70bc3-0da3-5662-8efe-cf1899751f57', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, 'c7027595-6095-521c-9087-8a2cb3efba5b', 'single_choice', 'O que são condicionantes de uma licença ambiental?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('6fccad20-0d20-534f-b596-c70ff462b673', '8bf70bc3-0da3-5662-8efe-cf1899751f57', 'Obrigações específicas que o empreendedor deve cumprir e comprovar para manter a licença válida',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('6c96daee-045a-5e8a-94b0-9ba6613876cd', '8bf70bc3-0da3-5662-8efe-cf1899751f57', 'Recomendações sem caráter obrigatório',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('cc5b605f-9b96-507f-a23f-78c38b6a9a8c', '8bf70bc3-0da3-5662-8efe-cf1899751f57', 'Prazos de validade da licença',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('2bc98ec8-0550-5031-aaa1-2c3579ea54c5', '8bf70bc3-0da3-5662-8efe-cf1899751f57', 'Taxas cobradas pelo órgão ambiental',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('43de7b99-f1f1-5e5d-ab4d-5927fcf677bf', '8bf70bc3-0da3-5662-8efe-cf1899751f57', 2, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('e98b5b27-d083-556e-841d-8e31d0b51644', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, 'c7027595-6095-521c-9087-8a2cb3efba5b', 'single_choice', 'Diante de um vazamento de óleo em solo, qual é a primeira ação?',
        1, 'Remediar sem estancar é enxugar gelo: a fonte continua alimentando o dano enquanto a equipe trabalha.', NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('60a5bb4e-1231-5d8f-9c0f-962ff1d5cb0b', 'e98b5b27-d083-556e-841d-8e31d0b51644', 'Estancar a fonte com segurança e conter o avanço antes de qualquer remediação',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('d2471223-5132-53dc-9cb1-1c118e04f9e2', 'e98b5b27-d083-556e-841d-8e31d0b51644', 'Coletar amostras para o laboratório',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('6545bb7f-6627-547e-ac50-6e8304326396', 'e98b5b27-d083-556e-841d-8e31d0b51644', 'Comunicar a imprensa local',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('e2946a4c-ab56-5d7a-aabb-8b4ffc905f0b', 'e98b5b27-d083-556e-841d-8e31d0b51644', 'Iniciar a remoção do solo contaminado',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('43de7b99-f1f1-5e5d-ab4d-5927fcf677bf', 'e98b5b27-d083-556e-841d-8e31d0b51644', 3, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('ff5bb466-4514-5089-82c2-694ab66e1aa8', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, 'c7027595-6095-521c-9087-8a2cb3efba5b', 'single_choice', 'Por que a destinação de resíduos exige documento de rastreabilidade?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('cd5955d5-1413-5689-9a02-8425b953f688', 'ff5bb466-4514-5089-82c2-694ab66e1aa8', 'Porque a responsabilidade pelo resíduo acompanha o gerador até a destinação final',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('53abdbb8-05ac-5f39-aafe-67d92c66bb6d', 'ff5bb466-4514-5089-82c2-694ab66e1aa8', 'Porque o transportador exige nota fiscal',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('727cbc1d-129f-5720-b0ae-0dde18d9a754', 'ff5bb466-4514-5089-82c2-694ab66e1aa8', 'Porque o documento reduz o custo do transporte',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('a8240872-1ffb-526e-bca8-72e51313b656', 'ff5bb466-4514-5089-82c2-694ab66e1aa8', 'Porque o resíduo perde classificação após a coleta',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('43de7b99-f1f1-5e5d-ab4d-5927fcf677bf', 'ff5bb466-4514-5089-82c2-694ab66e1aa8', 4, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
UPDATE courses SET min_grade_percent = 70 WHERE id = 'c7027595-6095-521c-9087-8a2cb3efba5b';

INSERT INTO quizzes (id, tenant_id, course_id, lesson_id, title, description,
                     time_limit_minutes, max_attempts, passing_score, grading_method,
                     shuffle_questions, shuffle_options, questions_per_page,
                     sequential_navigation, feedback_mode)
VALUES ('0dc2d6f4-362b-5beb-9709-3b91b3aa0cc1', (SELECT id FROM tenants WHERE slug = 'exemplo'), '65c85afb-fd59-575d-8754-15fee87d6589', NULL, 'Avaliação final — Processamento e Tratamento de Gás', 'Quatro questões sobre desidratação, compressão e especificação.',
        30, 3, 70, 'best',
        false, true, 1, false, 'on_submit')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  passing_score = EXCLUDED.passing_score, max_attempts = EXCLUDED.max_attempts,
  time_limit_minutes = EXCLUDED.time_limit_minutes;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('e57f3aea-a0b5-59d4-bdf9-f1c2dd7fa353', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '65c85afb-fd59-575d-8754-15fee87d6589', 'single_choice', 'Por que o gás natural precisa ser desidratado antes do transporte?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('ad7dddaa-f2b0-5170-9b2a-f878ce49701c', 'e57f3aea-a0b5-59d4-bdf9-f1c2dd7fa353', 'Para evitar formação de hidratos e corrosão na tubulação',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('e47a2384-d08d-5a78-8faa-2611645bb64a', 'e57f3aea-a0b5-59d4-bdf9-f1c2dd7fa353', 'Para aumentar o poder calorífico do gás',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('2b9d85ee-7089-54d4-acb1-70f7a1deebb7', 'e57f3aea-a0b5-59d4-bdf9-f1c2dd7fa353', 'Para reduzir o volume transportado',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('e8f3d5d6-11bc-537c-804f-482bf336f56d', 'e57f3aea-a0b5-59d4-bdf9-f1c2dd7fa353', 'Para separar o metano do etano',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('0dc2d6f4-362b-5beb-9709-3b91b3aa0cc1', 'e57f3aea-a0b5-59d4-bdf9-f1c2dd7fa353', 1, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('220d8383-aadc-524f-8596-e055a9a6879f', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '65c85afb-fd59-575d-8754-15fee87d6589', 'single_choice', 'Qual substância é usada na desidratação por absorção?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('9a3ccc80-77a7-557e-bc16-631adb02fb56', '220d8383-aadc-524f-8596-e055a9a6879f', 'Trietilenoglicol (TEG)',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('236be396-ed79-501a-a113-963dda8cf546', '220d8383-aadc-524f-8596-e055a9a6879f', 'Ácido sulfúrico',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('c8cf482f-43b1-59e5-8ce7-04cc06e389ca', '220d8383-aadc-524f-8596-e055a9a6879f', 'Metanol puro',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('16201d3b-1ecf-566b-b5a5-232bc14ad319', '220d8383-aadc-524f-8596-e055a9a6879f', 'Água desmineralizada',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('0dc2d6f4-362b-5beb-9709-3b91b3aa0cc1', '220d8383-aadc-524f-8596-e055a9a6879f', 2, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('279a3059-866a-5237-9073-fd14c28deb42', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '65c85afb-fd59-575d-8754-15fee87d6589', 'single_choice', 'O que é o ponto de orvalho de hidrocarbonetos?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('4805b4f4-826a-53fa-957f-5d3ab3366b6e', '279a3059-866a-5237-9073-fd14c28deb42', 'A temperatura em que os hidrocarbonetos mais pesados começam a condensar',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('45738697-0ef9-52a5-a7ce-3dbf4ccc3fdf', '279a3059-866a-5237-9073-fd14c28deb42', 'A temperatura de ignição do gás',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('bb3c1990-77da-56c6-8a9b-5091b005cd92', '279a3059-866a-5237-9073-fd14c28deb42', 'A pressão máxima de operação do compressor',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('05e70cb3-c31f-5026-be6d-37e6a0c77c73', '279a3059-866a-5237-9073-fd14c28deb42', 'A temperatura em que o gás congela',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('0dc2d6f4-362b-5beb-9709-3b91b3aa0cc1', '279a3059-866a-5237-9073-fd14c28deb42', 3, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('8a172c7a-020d-5bae-a697-92d2fec49faa', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '65c85afb-fd59-575d-8754-15fee87d6589', 'single_choice', 'Para que serve o tratamento de remoção de H2S?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('bcb5d722-aaa3-59e3-bb53-e9c6471a7519', '8a172c7a-020d-5bae-a697-92d2fec49faa', 'Para atender à especificação e evitar toxicidade e corrosão ácida',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('eeefde5c-a349-53d1-a029-73223185d215', '8a172c7a-020d-5bae-a697-92d2fec49faa', 'Para elevar a pressão de entrega',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('1e2f7dd4-b0a5-5575-9086-d70b11327f79', '8a172c7a-020d-5bae-a697-92d2fec49faa', 'Para aumentar a densidade do gás',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('fdf71b86-8f4e-504c-a93e-e25e83cbec70', '8a172c7a-020d-5bae-a697-92d2fec49faa', 'Para permitir a medição fiscal',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('0dc2d6f4-362b-5beb-9709-3b91b3aa0cc1', '8a172c7a-020d-5bae-a697-92d2fec49faa', 4, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
UPDATE courses SET min_grade_percent = 70 WHERE id = '65c85afb-fd59-575d-8754-15fee87d6589';

INSERT INTO quizzes (id, tenant_id, course_id, lesson_id, title, description,
                     time_limit_minutes, max_attempts, passing_score, grading_method,
                     shuffle_questions, shuffle_options, questions_per_page,
                     sequential_navigation, feedback_mode)
VALUES ('871eaf03-1f83-5ede-ba63-a27f700b4366', (SELECT id FROM tenants WHERE slug = 'exemplo'), '8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', NULL, 'Avaliação final — Comunicação com a Comunidade', 'Quatro questões sobre linguagem, canais e transparência.',
        25, 3, 70, 'best',
        false, true, 1, false, 'on_submit')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  passing_score = EXCLUDED.passing_score, max_attempts = EXCLUDED.max_attempts,
  time_limit_minutes = EXCLUDED.time_limit_minutes;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('c1759014-edd7-5923-85a4-aa082525c51d', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', 'single_choice', 'Ao comunicar um desvio operacional à comunidade, o que deve vir primeiro?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('e3f1c095-e6e7-5cb5-bc0e-c88e6f2d009f', 'c1759014-edd7-5923-85a4-aa082525c51d', 'O que aconteceu, o que já foi feito e o que ainda será feito, em linguagem simples',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('b88fbfb6-e1c4-5aee-ae6c-b91fab3ef0c6', 'c1759014-edd7-5923-85a4-aa082525c51d', 'A explicação técnica detalhada do equipamento envolvido',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('393d2f36-7915-580b-8935-8f55f3f20ebb', 'c1759014-edd7-5923-85a4-aa082525c51d', 'A garantia de que não houve risco, antes da apuração',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('a41af227-0a34-5d8a-8479-e5bc3a67df41', 'c1759014-edd7-5923-85a4-aa082525c51d', 'O histórico de conformidade da empresa',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('871eaf03-1f83-5ede-ba63-a27f700b4366', 'c1759014-edd7-5923-85a4-aa082525c51d', 1, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('fe703682-98d0-5351-9b6f-fcc513fd04fd', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', 'single_choice', 'Por que evitar jargão técnico na comunicação comunitária?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('decaf082-097c-55b8-be12-cf5f5804db86', 'fe703682-98d0-5351-9b6f-fcc513fd04fd', 'Porque a mensagem que não é entendida não foi comunicada, e o vazio é preenchido por boato',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('66b031a6-75a1-5b62-99a1-3fa358ecec15', 'fe703682-98d0-5351-9b6f-fcc513fd04fd', 'Porque o jargão é proibido pela legislação',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('6e37f2b3-3f64-550e-9ff2-72fab1e0191b', 'fe703682-98d0-5351-9b6f-fcc513fd04fd', 'Porque encarece a produção do material',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('78e8d63d-b629-5b73-96b4-e1b742a9ec7e', 'fe703682-98d0-5351-9b6f-fcc513fd04fd', 'Porque a comunidade não tem interesse em detalhes',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('871eaf03-1f83-5ede-ba63-a27f700b4366', 'fe703682-98d0-5351-9b6f-fcc513fd04fd', 2, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('6ab1edbb-9c60-563c-af61-368a9c1f7d82', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', 'single_choice', 'Qual é o papel do canal de atendimento à comunidade?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('050820d7-b5b2-5dd6-9569-c34e2cc31431', '6ab1edbb-9c60-563c-af61-368a9c1f7d82', 'Receber manifestações, dar resposta rastreável e alimentar a melhoria da operação',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('80a7c109-13a6-5da0-b0d7-b23834726618', '6ab1edbb-9c60-563c-af61-368a9c1f7d82', 'Divulgar os resultados financeiros da companhia',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('c3384013-8163-5746-a933-419c5da0ca8b', '6ab1edbb-9c60-563c-af61-368a9c1f7d82', 'Substituir as reuniões públicas do licenciamento',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('8c1164f0-ee09-5f22-ab4f-fa89143251de', '6ab1edbb-9c60-563c-af61-368a9c1f7d82', 'Registrar apenas elogios e sugestões',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('871eaf03-1f83-5ede-ba63-a27f700b4366', '6ab1edbb-9c60-563c-af61-368a9c1f7d82', 3, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
INSERT INTO questions (id, tenant_id, category_id, course_id, kind, prompt, points, explanation, author_id)
VALUES ('857e526c-8773-51ae-978a-f3148cad6631', (SELECT id FROM tenants WHERE slug = 'exemplo'), NULL, '8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', 'single_choice', 'O que compromete a confiança construída com a comunidade?',
        1, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, explanation = EXCLUDED.explanation;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('9667da6e-6fd2-50e1-a7dc-942488c17014', '857e526c-8773-51ae-978a-f3148cad6631', 'Prometer prazo que não se cumpre e não voltar para explicar por quê',
        true, 1)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('626ab94b-16ab-5ee6-8ad9-37005e74d954', '857e526c-8773-51ae-978a-f3148cad6631', 'Informar que um assunto ainda está em apuração',
        false, 2)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('32ed2ed6-d5e1-5809-93b3-9da2d13cc518', '857e526c-8773-51ae-978a-f3148cad6631', 'Reconhecer publicamente um erro da operação',
        false, 3)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO question_options (id, question_id, text, is_correct, position)
VALUES ('4b1b3689-1177-5d92-9455-ea60c4b7373e', '857e526c-8773-51ae-978a-f3148cad6631', 'Convidar moradores para visitar a instalação',
        false, 4)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct,
  position = EXCLUDED.position;
INSERT INTO quiz_questions (quiz_id, question_id, position, points)
VALUES ('871eaf03-1f83-5ede-ba63-a27f700b4366', '857e526c-8773-51ae-978a-f3148cad6631', 4, 1)
ON CONFLICT (quiz_id, question_id) DO UPDATE SET position = EXCLUDED.position;
UPDATE courses SET min_grade_percent = 70 WHERE id = '8e06f60b-00b7-50af-8a4d-61e0f10c9c3f';

-- -------------------------------------------------------------- materiais
-- O mock traz o tamanho já formatado ("480 kB"); a tabela guarda bytes e a
-- formatação é do repositório. Converter aqui evita duas verdades sobre o
-- mesmo arquivo.
--
-- `storage_key` aponta para um objeto que NÃO existe no storage: o seed não
-- sobe arquivo. Baixar um destes devolve erro do storage, e é o esperado —
-- o que o seed prova é que a listagem vem do banco, não do mock.
INSERT INTO materials (id, lesson_id, name, kind, size_bytes, storage_key, uploaded_by)
VALUES ('e6c8fc25-50fc-56a6-aa67-27cab07e6d6a', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'Checklist de inspeção do separador',
        'pdf', 491520,
        'materiais/c1m3-l5/1-pdf', '0241e68a-9b21-5658-bcd4-55cfa515d63c')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, kind = EXCLUDED.kind, size_bytes = EXCLUDED.size_bytes;
INSERT INTO materials (id, lesson_id, name, kind, size_bytes, storage_key, uploaded_by)
VALUES ('e29eaff4-39a0-5880-8b3f-2ba72d82aa79', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'Planilha de acompanhamento de BSW',
        'spreadsheet', 63488,
        'materiais/c1m3-l5/2-spreadsheet', '0241e68a-9b21-5658-bcd4-55cfa515d63c')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, kind = EXCLUDED.kind, size_bytes = EXCLUDED.size_bytes;
INSERT INTO materials (id, lesson_id, name, kind, size_bytes, storage_key, uploaded_by)
VALUES ('1e91cc23-5ce2-50cc-bf8a-9500821ea9ab', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'Procedimento de tratamento de emulsão',
        'pdf', 1258291,
        'materiais/c1m3-l5/3-pdf', '0241e68a-9b21-5658-bcd4-55cfa515d63c')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, kind = EXCLUDED.kind, size_bytes = EXCLUDED.size_bytes;

COMMIT;
