-- P2 #14: Drop dead D1 tables (3 tables, 0 references in code)
-- chart_generation_log: was for fal.ai chart images, never imported
-- business_connections: from a forgotten migration, never read or written
-- psycho_profile (note typo): the real table is psych_profile
DROP TABLE IF EXISTS chart_generation_log;
DROP TABLE IF EXISTS business_connections;
DROP TABLE IF EXISTS psycho_profile;
