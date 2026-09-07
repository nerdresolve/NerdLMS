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
VALUES ('58a9bb76-23b8-550e-8122-09cd019f99f0', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Holding' LIMIT 1),
        'admin.mock@exemplo.com.br', 'Ana Ribeiro', '$scrypt$ln=17,r=8,p=1$n9CyE6ONgLfupE1Sg/jdVQ$uePF9ZVY7rDefUY/m8yYDi4+h90UFVl7eljv6XMqzWU',
        'admin', 'active', 'Holding', 'Rio de Janeiro',
        '2026-08-12T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('c74c631a-3d85-5bb1-a040-19b48741ef2c', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Prolagos' LIMIT 1),
        'manager.mock@exemplo.com.br', 'Sérgio Bastos', '$scrypt$ln=17,r=8,p=1$nmKUQWYJJXvtSbyfPpQqRg$35GrbRvSdCUzleEkyq187xQ6oP6GyxGYxJ2LTsFF5CA',
        'manager', 'active', 'Prolagos', 'Região dos Lagos',
        '2026-08-10T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('0241e68a-9b21-5658-bcd4-55cfa515d63c', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Águas do Rio' LIMIT 1),
        'instructor.mock@exemplo.com.br', 'Rafael Nunes', '$scrypt$ln=17,r=8,p=1$OLF4SWLyMP4mSEbKmgEC1A$Jjzm+ZoTb5XpR/Tm4Zigf5ZB3iR1KgDatJOeXpUgt6k',
        'instructor', 'active', 'Águas do Rio', 'Rio de Janeiro',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Escola Social' LIMIT 1),
        'instructor2.mock@exemplo.com.br', 'Camila Prado', '$scrypt$ln=17,r=8,p=1$Hvn7Kg/8EZU+jaFNMDg1/g$cuaOUD88vTePShbTJXDwEoYghblFCbib2AtN+meZDHY',
        'instructor', 'active', 'Escola Social', 'Região dos Lagos',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Escola Social' LIMIT 1),
        'user.mock@exemplo.com.br', 'Maria Souza', '$scrypt$ln=17,r=8,p=1$2pAwMEwApjMuKpRUKYeYZQ$G0IDt0EEpRBsxlGJ1H3mEN7syXMTLUly4/JnHUJ8aeo',
        'learner', 'active', 'Escola Social', 'Rio de Janeiro',
        '2026-08-11T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('26757df8-30c8-5c63-805a-197a8d9593db', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Águas do Rio' LIMIT 1),
        'joao.peixoto@exemplo.com.br', 'João Peixoto', NULL,
        'learner', 'active', 'Águas do Rio', 'Rio de Janeiro',
        '2026-08-12T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('bb1f7d87-6677-544a-af56-3d38c5e3ca65', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Prolagos' LIMIT 1),
        'carla.menezes@exemplo.com.br', 'Carla Menezes', NULL,
        'learner', 'active', 'Prolagos', 'Região dos Lagos',
        '2026-08-06T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('cde71ffa-eb22-541b-af5f-88f1b9bec629', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Regenera Rio' LIMIT 1),
        'diego.ramos@exemplo.com.br', 'Diego Ramos', NULL,
        'learner', 'active', 'Regenera Rio', 'Baixada Fluminense',
        '2026-07-31T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('fdf36cb8-b946-59ac-9d69-90756d18a0dc', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Escola Social' LIMIT 1),
        'priscila.alves@exemplo.com.br', 'Priscila Alves', NULL,
        'learner', 'active', 'Escola Social', 'Rio de Janeiro',
        '2026-07-25T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('d958b9da-9f14-57db-ac67-8cd7fc77c167', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Águas do Rio' LIMIT 1),
        'marcos.tavares@exemplo.com.br', 'Marcos Tavares', NULL,
        'learner', 'active', 'Águas do Rio', 'Região dos Lagos',
        '2026-07-19T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('ae870e0b-ede4-51ef-8f59-05172aa84a08', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Prolagos' LIMIT 1),
        'helena.duarte@exemplo.com.br', 'Helena Duarte', NULL,
        'learner', 'pending', 'Prolagos', 'Baixada Fluminense',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Regenera Rio' LIMIT 1),
        'rogerio.lima@exemplo.com.br', 'Rogério Lima', NULL,
        'learner', 'active', 'Regenera Rio', 'Rio de Janeiro',
        '2026-07-07T15:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;
INSERT INTO users (id, tenant_id, org_unit_id, email, full_name, password_hash, role, status, project, region, last_access_at)
VALUES ('3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', (SELECT id FROM tenants WHERE slug = 'lms'), (SELECT id FROM org_units WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'lms') AND name = 'Escola Social' LIMIT 1),
        'bianca.ferraz@exemplo.com.br', 'Bianca Ferraz', NULL,
        'learner', 'pending', 'Escola Social', 'Região dos Lagos',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
  status = EXCLUDED.status, project = EXCLUDED.project, region = EXCLUDED.region,
  last_access_at = EXCLUDED.last_access_at;

-- ------------------------------------------------------------------- cursos
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('cf9de71e-2aa2-5c0f-928b-0c8b211c512c', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        '0241e68a-9b21-5658-bcd4-55cfa515d63c', 'tratamento-de-agua-fundamentos', 'Tratamento de Água: Fundamentos',
        'Da captação à distribuição: as etapas que tornam a água potável e segura.', 'published', 'assigned')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('8145bed3-edf2-55a1-836a-392900cd3d7e', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        '0241e68a-9b21-5658-bcd4-55cfa515d63c', 'gestao-de-perdas', 'Gestão de Perdas na Distribuição',
        'Como medir, localizar e reduzir perdas reais e aparentes na rede.', 'published', 'assigned')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('57cfcb32-8049-5ba4-9c92-45351df8de19', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', 'seguranca-em-operacoes-de-campo', 'Segurança em Operações de Campo',
        'Procedimentos obrigatórios para escavação, espaço confinado e trabalho em via pública.', 'published', 'assigned')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('24c2669e-c4de-5632-81fb-6e761cc86d3f', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', 'atendimento-ao-cliente', 'Atendimento ao Cliente',
        'Escuta, clareza e resolução na relação com o usuário do serviço.', 'published', 'open')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('c7027595-6095-521c-9087-8a2cb3efba5b', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', 'saneamento-e-saude-publica', 'Saneamento e Saúde Pública',
        'A relação entre água tratada, esgoto coletado e indicadores de saúde na população.', 'published', 'open')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('65c85afb-fd59-575d-8754-15fee87d6589', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        '0241e68a-9b21-5658-bcd4-55cfa515d63c', 'tratamento-de-esgoto', 'Tratamento de Esgoto: Processos',
        'Do interceptor ao corpo receptor: as etapas do tratamento e os parâmetros de lançamento.', 'published', 'assigned')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;
INSERT INTO courses (id, tenant_id, org_unit_id, author_id, slug, title, summary, status, enrollment_mode)
VALUES ('8e06f60b-00b7-50af-8a4d-61e0f10c9c3f', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        '7c7446d4-8be6-5ed5-b50b-6e03afe7de6b', 'comunicacao-com-a-comunidade', 'Comunicação com a Comunidade',
        'Como explicar obra, interrupção e tarifa para quem é afetado por elas.', 'published', 'open')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, status = EXCLUDED.status;

-- ---------------------------------------------------------- módulos e aulas
INSERT INTO modules (id, course_id, title, position)
VALUES ('4064f859-dff9-5e13-b269-d8263eaeaf76', 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'Captação e adução', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0163bc85-3f12-5418-94aa-d72ccf61ce78', '4064f859-dff9-5e13-b269-d8263eaeaf76', 'Mananciais e outorga',
        1680, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('1569933a-99bf-5303-a01f-5a87cc9c71fb', '4064f859-dff9-5e13-b269-d8263eaeaf76', 'Captação superficial',
        1680, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('8d55e479-8d31-5961-9d30-28c83e530704', '4064f859-dff9-5e13-b269-d8263eaeaf76', 'Adução e recalque',
        1680, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('fbba2eb4-ea03-5633-bde8-1baf605ec0e5', '4064f859-dff9-5e13-b269-d8263eaeaf76', 'Reservação',
        1680, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('f91d7510-682f-5bd2-af3e-feba78e8db1a', 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'Coagulação e floculação', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0df3ce97-0592-587a-b01a-aeaec3861a88', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Química da coagulação',
        1800, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('f21ee8e1-2849-58da-9aff-773395036bf8', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Dosagem de coagulante',
        1800, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('5abb4730-24a9-5083-aa53-be2360b77461', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Floculadores',
        1800, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('8fdf82ad-1fa6-5b86-9e23-f35313af5293', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Ensaio de jarros',
        1800, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('f43fb5f4-498b-5f7d-84b7-849d1329951d', 'f91d7510-682f-5bd2-af3e-feba78e8db1a', 'Controle operacional',
        1800, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('087b3034-72a4-5ca2-a810-d5272961a693', 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'Decantação e filtração', 3)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('5e6f4c7b-912a-51e9-b7d8-31e3f93f347f', '087b3034-72a4-5ca2-a810-d5272961a693', 'Decantadores',
        1560, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('bb137a86-2fcd-591f-8c80-064124a19cbe', '087b3034-72a4-5ca2-a810-d5272961a693', 'Filtros rápidos',
        1560, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('770ce5df-501f-54de-b722-37cf64d07095', '087b3034-72a4-5ca2-a810-d5272961a693', 'Retrolavagem',
        1560, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('9a4a2ce1-bd96-519e-8261-12f355f12452', '087b3034-72a4-5ca2-a810-d5272961a693', 'Perda de carga',
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
VALUES ('0839fcc1-0476-565c-89ba-003ee14153db', 'cf9de71e-2aa2-5c0f-928b-0c8b211c512c', 'Desinfecção e controle', 4)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('d7ba7376-3820-5e12-a118-fa6c07fa9071', '0839fcc1-0476-565c-89ba-003ee14153db', 'Cloração',
        1920, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('5887dc59-2a83-5fbf-9b0f-75ae3aab3b26', '0839fcc1-0476-565c-89ba-003ee14153db', 'Residual na rede',
        1920, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('163cfbda-0621-5db5-845a-45d4bfea32f9', '0839fcc1-0476-565c-89ba-003ee14153db', 'Análises de potabilidade',
        1920, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('a2572758-cd9b-52c0-adfc-b5ca8463538d', '0839fcc1-0476-565c-89ba-003ee14153db', 'Portaria de qualidade',
        1920, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('3afe61f8-a922-5edd-80dd-f8283f0c9030', '8145bed3-edf2-55a1-836a-392900cd3d7e', 'Balanço hídrico', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('04a9e4b1-e038-5d53-8340-bae65cb8b45e', '3afe61f8-a922-5edd-80dd-f8283f0c9030', 'Indicadores de perda',
        1440, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('be13856f-86f3-5fd3-b326-53aad354890e', '3afe61f8-a922-5edd-80dd-f8283f0c9030', 'Macromedição',
        1440, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('d6f20afd-8737-5595-9b79-3ac70ac8990a', '3afe61f8-a922-5edd-80dd-f8283f0c9030', 'Setorização',
        1440, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('e61af914-4366-5764-8b2a-59d6618bca07', '3afe61f8-a922-5edd-80dd-f8283f0c9030', 'Distritos de medição',
        1440, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('f738a8c1-e584-5c23-9a15-bff9f7390a77', '8145bed3-edf2-55a1-836a-392900cd3d7e', 'Perdas reais', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('803daec1-89c1-5a4d-8373-3387775c36a6', 'f738a8c1-e584-5c23-9a15-bff9f7390a77', 'Pesquisa de vazamento',
        1620, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('37564443-a75a-5c8f-a4ba-19d2e853f14b', 'f738a8c1-e584-5c23-9a15-bff9f7390a77', 'Geofonamento',
        1620, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0dde7e91-a3b7-511d-b950-8ceb3a98412e', 'f738a8c1-e584-5c23-9a15-bff9f7390a77', 'Pressão e vazamento',
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
VALUES ('8c01febb-14b7-5114-8f6f-6b4afb658c90', '8145bed3-edf2-55a1-836a-392900cd3d7e', 'Perdas aparentes', 3)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0edbef35-b53e-5ded-8e20-7e256d5e256d', '8c01febb-14b7-5114-8f6f-6b4afb658c90', 'Submedição',
        1560, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('a7b58919-057f-563e-87dc-64a56b69b4c6', '8c01febb-14b7-5114-8f6f-6b4afb658c90', 'Parque de hidrômetros',
        1560, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('ccae051e-bb66-5aa1-9d2b-3f3f0d7cfded', '8c01febb-14b7-5114-8f6f-6b4afb658c90', 'Fraudes',
        1560, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('71b79a7a-f1ef-590e-87d3-e852858dec3b', '8c01febb-14b7-5114-8f6f-6b4afb658c90', 'Recuperação de receita',
        1560, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('77a8a967-24d7-5413-a6bf-376cc0cfdaca', '57cfcb32-8049-5ba4-9c92-45351df8de19', 'Fundamentos', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('530747dc-0cff-5b78-88a2-0bdd44e61fd2', '77a8a967-24d7-5413-a6bf-376cc0cfdaca', 'Análise de risco',
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
VALUES ('56e95570-bca2-5957-ba3e-43ba7a8c8bbe', '57cfcb32-8049-5ba4-9c92-45351df8de19', 'Escavação e via pública', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('ff404be9-3e5a-5aa0-8edb-063bef94509b', '56e95570-bca2-5957-ba3e-43ba7a8c8bbe', 'Sinalização viária',
        1800, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('bd38cf1a-5b8b-5260-ad17-180f95b65923', '56e95570-bca2-5957-ba3e-43ba7a8c8bbe', 'Escoramento de valas',
        1800, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('868426c1-b467-5e65-8476-ca76d5e1b276', '56e95570-bca2-5957-ba3e-43ba7a8c8bbe', 'Interferências enterradas',
        1800, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('828e9627-8a91-57bb-9702-ddcfecf4caca', '56e95570-bca2-5957-ba3e-43ba7a8c8bbe', 'Reaterro',
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
VALUES ('5bce3704-eb6a-5a8f-81d1-5152cc7dd7b7', '944e170a-1de0-5e63-97de-63a7bbf1869e', 'Vazamento de cloro',
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
VALUES ('ce63142b-913c-560f-bf78-1effb1ef1935', '24c2669e-c4de-5632-81fb-6e761cc86d3f', 'A relação com o usuário', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('01412b8c-13a7-5f7f-9ef9-cbdfe51ca2ea', 'ce63142b-913c-560f-bf78-1effb1ef1935', 'Direitos do consumidor',
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
VALUES ('0b500745-d247-5ac6-a384-25124fb2f001', 'ce63142b-913c-560f-bf78-1effb1ef1935', 'Registro do chamado',
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
VALUES ('5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d', 'eb96e456-1801-5d27-86ab-d306e7417be4', 'Falta d''água',
        1440, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('34849aa4-5fca-5429-8217-2cdc41901c86', 'eb96e456-1801-5d27-86ab-d306e7417be4', 'Conta em disputa',
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
VALUES ('ac2197e2-a19d-53f0-91fe-fd01c52204d7', '2dc9fc55-9a15-5abd-ab1c-61b71fc9152e', 'Doenças de veiculação hídrica',
        1560, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('9b79a442-5df4-51d7-83d4-ab98d4714921', '2dc9fc55-9a15-5abd-ab1c-61b71fc9152e', 'Indicadores de saúde',
        1560, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('6167b04a-2c7d-53eb-b5d7-3409c8adf32e', '2dc9fc55-9a15-5abd-ab1c-61b71fc9152e', 'O papel do saneamento',
        1560, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('ec8fd3d1-e5e3-57bd-977d-495e37aae9ac', 'c7027595-6095-521c-9087-8a2cb3efba5b', 'Território e desigualdade', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('0e5a7042-9841-5e9c-b216-0dc47403d806', 'ec8fd3d1-e5e3-57bd-977d-495e37aae9ac', 'Mapeamento de vulnerabilidade',
        1800, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('4f0aeaf3-e518-5b89-b84c-16793a53ff55', 'ec8fd3d1-e5e3-57bd-977d-495e37aae9ac', 'Universalização',
        1800, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('400cc800-f043-51ae-9e58-edd6e14c145a', 'ec8fd3d1-e5e3-57bd-977d-495e37aae9ac', 'Casos brasileiros',
        1800, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO modules (id, course_id, title, position)
VALUES ('4d3fddd1-9d95-52fe-b4b4-7a81e505a3c5', '65c85afb-fd59-575d-8754-15fee87d6589', 'Tratamento preliminar', 1)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('bcfcc07a-a6ba-50bd-82b7-6bcc64bcd751', '4d3fddd1-9d95-52fe-b4b4-7a81e505a3c5', 'Gradeamento',
        1440, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('64d7715a-b177-51bc-a79c-2ca99ebc4b65', '4d3fddd1-9d95-52fe-b4b4-7a81e505a3c5', 'Desarenação',
        1440, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('e6f2874b-388a-5dc9-ac11-0e322a983e52', '4d3fddd1-9d95-52fe-b4b4-7a81e505a3c5', 'Medição de vazão',
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
VALUES ('6862261d-36e2-576c-bef0-0337e82f0d98', '65c85afb-fd59-575d-8754-15fee87d6589', 'Tratamento biológico', 2)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('8acdfd07-d366-5d00-9c2e-721efc1abe59', '6862261d-36e2-576c-bef0-0337e82f0d98', 'Lodos ativados',
        1920, 1)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds,
  position = EXCLUDED.position;
INSERT INTO lessons (id, module_id, title, duration_seconds, position)
VALUES ('9ca0aa0c-d47c-5057-ab06-27498e1efa10', '6862261d-36e2-576c-bef0-0337e82f0d98', 'Reatores anaeróbios',
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
VALUES ('1bec7c64-be5c-5ff2-9fa9-60d29b558f69', '6862261d-36e2-576c-bef0-0337e82f0d98', 'Lodo gerado',
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
        NULL, 'O trecho sobre expansão do leito durante a retrolavagem esclareceu uma dúvida que eu tinha há tempos. Vale rever a partir dos 12 minutos.',
        false, '2026-08-05T09:44:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('b8a8acb7-d04e-55c0-ac9b-10018845d91e', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65',
        NULL, 'Uma dica prática: registre a perda de carga no início e no fim do turno. Em duas semanas você já enxerga o padrão do seu filtro sem precisar de planilha.',
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
        NULL, 'Complementando: aqui a gente adotou medir nos três níveis da vala, e não só na boca. Já achamos diferença de quase 2% entre o topo e o fundo.',
        false, '2026-08-07T10:48:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('454419ad-5ffe-5e68-af8e-af966bc3d31d', '5ae714c4-7e4e-5ea6-a4a7-5351f36ea65d', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65',
        NULL, 'O que fazer quando a pessoa liga pela terceira vez no mesmo dia sobre a mesma falta d''água? O protocolo continua o mesmo, mas ela já está sem paciência com o roteiro.',
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
        NULL, 'A parte de trocar termo técnico por linguagem comum ajudou. Aqui a gente falava "intermitência no abastecimento" e a pessoa entendia que era problema na casa dela.',
        false, '2026-08-09T16:30:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', '37564443-a75a-5c8f-a4ba-19d2e853f14b', '26757df8-30c8-5c63-805a-197a8d9593db',
        NULL, 'No geofonamento, ruído de trânsito atrapalha muito no nosso setor. Alguém consegue fazer de dia com resultado ou aqui é caso de virar noturno mesmo?',
        false, '2026-08-10T08:15:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('ac4f8162-d4fc-59a6-bd3d-38791d4ca767', '37564443-a75a-5c8f-a4ba-19d2e853f14b', '0241e68a-9b21-5658-bcd4-55cfa515d63c',
        'e1f0e8f4-ec8e-54a6-92d1-24b652d61b2b', 'Em via movimentada, noturno rende mais — não é preferência, é que o ruído de fundo mascara a faixa de frequência do vazamento. Se não der para ir à noite, vale a pré-localização por setor durante o dia e reservar a escuta fina para o horário calmo. Assim você não perde o dia inteiro.',
        true, '2026-08-10T10:40:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('50a2db74-dd97-56ef-866e-bee4bef26328', '04a9e4b1-e038-5d53-8340-bae65cb8b45e', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc',
        NULL, 'Fiquei na dúvida entre perda real e perda aparente no exemplo do minuto 9. Submedição de hidrômetro entra em qual das duas?',
        false, '2026-08-11T09:05:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;
INSERT INTO comments (id, lesson_id, author_id, parent_id, body, highlighted, created_at)
VALUES ('299698e4-dffe-578a-993f-531572f122a5', '04a9e4b1-e038-5d53-8340-bae65cb8b45e', '0241e68a-9b21-5658-bcd4-55cfa515d63c',
        '50a2db74-dd97-56ef-866e-bee4bef26328', 'Aparente. A água chegou e foi consumida, só não foi medida direito — é perda de faturamento, não de água. Perda real é a que não chega: vazamento, extravasamento de reservatório. A separação importa porque o combate é diferente: uma se resolve trocando hidrômetro, a outra escavando.',
        true, '2026-08-11T11:22:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  body = EXCLUDED.body, highlighted = EXCLUDED.highlighted;

INSERT INTO tracks (id, tenant_id, org_unit_id, slug, title, summary, mode, project)
VALUES ('4643cda7-bb07-5487-9c63-8b3e6f03849c', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        'operacao-de-agua', 'Operação de Água',
        'Do manancial à torneira: a formação completa de quem opera o sistema de abastecimento.', 'sequential', NULL)
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
VALUES ('dd46023b-ff2a-55b6-b94f-36452e2a6552', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        'atendimento-e-comunidade', 'Atendimento e Comunidade',
        'Como falar com quem é afetado pela operação, do balcão à obra na rua.', 'free', NULL)
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
VALUES ('3f378a67-0a42-5f25-b9ea-a75823c356ec', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        current_date + interval '-14 days', NULL,
        'Prazo: Segurança em Operações de Campo', 'deadline', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('54cc9ac2-ff8b-5543-931e-9ddcca7c3814', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        current_date + interval '-6 days', '14h às 17h',
        'Treinamento ao vivo: Retrolavagem', 'training', 'ETA Guandu', NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('fa24a185-6d1f-52a3-bf75-59d3a44e262a', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        current_date, NULL,
        'Comunicado: nova norma de potabilidade', 'announcement', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('969781a7-e3c7-5225-9b27-878dc325a706', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        current_date + interval '7 days', '9h às 12h',
        'Treinamento ao vivo: Integração', 'training', 'Online', NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('8bd3c98c-c744-5006-ad7d-f94857329654', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        current_date + interval '7 days', NULL,
        'Prazo: Atendimento ao Cliente', 'deadline', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;
INSERT INTO events (id, tenant_id, org_unit_id, on_date, time_label, title, kind, location, project)
VALUES ('55b31513-71e2-5756-9553-57e72a36bdf8', (SELECT id FROM tenants WHERE slug = 'lms'), NULL,
        current_date + interval '14 days', NULL,
        'Semana da Água', 'announcement', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  on_date = EXCLUDED.on_date, title = EXCLUDED.title, kind = EXCLUDED.kind,
  time_label = EXCLUDED.time_label, location = EXCLUDED.location;

INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('7dc5e22a-e8e4-51c4-9d38-e02d77769f87', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('b22f7de1-15f5-5a5f-a258-4b8377a40cc7', '26757df8-30c8-5c63-805a-197a8d9593db', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('08a0704e-1a44-53b4-90e9-cfdd7fa09293', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('7adad3c7-30b2-58af-b681-8942b7f8749c', 'cde71ffa-eb22-541b-af5f-88f1b9bec629', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('5f5ec1b5-d93e-58e7-9a2e-2b33d9db899e', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('f54bd80c-8aad-59bc-a3fd-1d75ecda4470', 'd958b9da-9f14-57db-ac67-8cd7fc77c167', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('7163ecb1-76f4-515c-9623-d929aec7bd6c', 'ae870e0b-ede4-51ef-8f59-05172aa84a08', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('28c69d83-cf69-5066-81bc-a44a5b01caed', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('a5a74cf8-df92-5f06-a6cd-aa8cc89e4166', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', 'Seu curso de Segurança vence em 2 dias',
        'Faltam 20 aulas para concluir Segurança em Operações de Campo.', 'reminder', current_date + interval '-1 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('d934363f-f192-5e99-bce0-55bfe5084598', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', 'Novo comunicado do RH',
        'A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('2d39ef45-3696-5689-89eb-43df43ec9699', '26757df8-30c8-5c63-805a-197a8d9593db', 'Novo comunicado do RH',
        'A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('875347c4-0bf8-5499-908b-388e650ddec8', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65', 'Novo comunicado do RH',
        'A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('abd86d87-cb71-52a7-8d02-0ea965c5b76d', 'cde71ffa-eb22-541b-af5f-88f1b9bec629', 'Novo comunicado do RH',
        'A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('0159070d-4ab4-52f4-90ab-122f59412550', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc', 'Novo comunicado do RH',
        'A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('a7b4fca3-9c89-51f7-8309-82bf387c7bd0', 'd958b9da-9f14-57db-ac67-8cd7fc77c167', 'Novo comunicado do RH',
        'A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('58f7a308-7f77-52b7-b8a3-4fa379617976', 'ae870e0b-ede4-51ef-8f59-05172aa84a08', 'Novo comunicado do RH',
        'A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('3d4099f3-ca4e-5036-b00f-d2a476e5ec2d', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', 'Novo comunicado do RH',
        'A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('4bcf2948-8f3e-52b0-9695-d1125102ef27', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', 'Novo comunicado do RH',
        'A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.', 'announcement', current_date + interval '-3 days',
        NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('2d19f4b2-fc02-5896-8487-d8cba0718984', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('a11ac871-af74-545a-b0d9-681709a2b1f6', '26757df8-30c8-5c63-805a-197a8d9593db', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('e8e7b5c3-5884-5012-8d8b-0075cd18e048', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('16218cf0-88a7-50b8-b426-1bd284181926', 'cde71ffa-eb22-541b-af5f-88f1b9bec629', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('918dc2cd-d7e0-5cd1-b07b-145c24ee9ef6', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('1ae0abcc-8b90-53de-912f-76031b18ca19', 'd958b9da-9f14-57db-ac67-8cd7fc77c167', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('84f8d9d7-2366-505e-a4e0-21d9a5287358', 'ae870e0b-ede4-51ef-8f59-05172aa84a08', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('534302df-16ae-5fdd-aa87-09d26f6e5529', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('57c6c8db-0a1d-5c07-a14a-554bb451fc19', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', 'Distintivo conquistado: Especialista em campo',
        'Você concluiu 30 aulas. Continue assim.', 'achievement', current_date + interval '-5 days',
        current_date + interval '-5 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('cf4ae772-7f78-531f-92d2-60f091a458f9', 'dd1b44e8-52f8-5b65-a243-5ecb7b6ba687', 'Rafael Nunes respondeu seu comentário',
        'Em Decantação e filtração · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('5e6226ab-b55b-5e61-b96a-cc25319b55f1', '26757df8-30c8-5c63-805a-197a8d9593db', 'Rafael Nunes respondeu seu comentário',
        'Em Decantação e filtração · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('2339d598-6b23-57db-a02b-e8665b80babd', 'bb1f7d87-6677-544a-af56-3d38c5e3ca65', 'Rafael Nunes respondeu seu comentário',
        'Em Decantação e filtração · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('01f188f2-5a3f-5d76-86f9-addbbc11376d', 'cde71ffa-eb22-541b-af5f-88f1b9bec629', 'Rafael Nunes respondeu seu comentário',
        'Em Decantação e filtração · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('5ccab087-03ae-5549-9455-155c4f78162e', 'fdf36cb8-b946-59ac-9d69-90756d18a0dc', 'Rafael Nunes respondeu seu comentário',
        'Em Decantação e filtração · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('5372ba1e-30c4-56ca-965e-74ed0efd6d47', 'd958b9da-9f14-57db-ac67-8cd7fc77c167', 'Rafael Nunes respondeu seu comentário',
        'Em Decantação e filtração · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('adb6a3e0-debf-501b-b34f-888dadcc3cc5', 'ae870e0b-ede4-51ef-8f59-05172aa84a08', 'Rafael Nunes respondeu seu comentário',
        'Em Decantação e filtração · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('23e12986-aab1-5982-8862-298084e7b4c7', 'ea9b5b74-3085-5794-a0e0-c3e0d1fe40a9', 'Rafael Nunes respondeu seu comentário',
        'Em Decantação e filtração · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;
INSERT INTO notifications (id, user_id, title, body, kind, created_at, read_at)
VALUES ('9f435228-c90d-55e3-bf21-2353d202d305', '3d6e6a4d-4b43-50a1-9e1a-b8ba278b0573', 'Rafael Nunes respondeu seu comentário',
        'Em Decantação e filtração · Falhas comuns.', 'announcement', current_date + interval '-8 days',
        current_date + interval '-8 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at;

-- -------------------------------------------------------------- materiais
-- O mock traz o tamanho já formatado ("480 kB"); a tabela guarda bytes e a
-- formatação é do repositório. Converter aqui evita duas verdades sobre o
-- mesmo arquivo.
--
-- `storage_key` aponta para um objeto que NÃO existe no storage: o seed não
-- sobe arquivo. Baixar um destes devolve erro do storage, e é o esperado —
-- o que o seed prova é que a listagem vem do banco, não do mock.
INSERT INTO materials (id, lesson_id, name, kind, size_bytes, storage_key, uploaded_by)
VALUES ('e6c8fc25-50fc-56a6-aa67-27cab07e6d6a', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'Checklist de inspeção de filtros',
        'pdf', 491520,
        'materiais/c1m3-l5/1-pdf', '0241e68a-9b21-5658-bcd4-55cfa515d63c')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, kind = EXCLUDED.kind, size_bytes = EXCLUDED.size_bytes;
INSERT INTO materials (id, lesson_id, name, kind, size_bytes, storage_key, uploaded_by)
VALUES ('e29eaff4-39a0-5880-8b3f-2ba72d82aa79', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'Planilha de perda de carga',
        'spreadsheet', 63488,
        'materiais/c1m3-l5/2-spreadsheet', '0241e68a-9b21-5658-bcd4-55cfa515d63c')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, kind = EXCLUDED.kind, size_bytes = EXCLUDED.size_bytes;
INSERT INTO materials (id, lesson_id, name, kind, size_bytes, storage_key, uploaded_by)
VALUES ('1e91cc23-5ce2-50cc-bf8a-9500821ea9ab', '44f96898-759b-5d5a-9b1c-4c5be9769615', 'Norma técnica de retrolavagem',
        'pdf', 1258291,
        'materiais/c1m3-l5/3-pdf', '0241e68a-9b21-5658-bcd4-55cfa515d63c')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, kind = EXCLUDED.kind, size_bytes = EXCLUDED.size_bytes;

COMMIT;
