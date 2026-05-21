-- ============================================================
-- RICEFW Estimator - Seed Data (from Excel workbook)
-- ============================================================

-- Sheet Types
INSERT INTO sheet_types (code, label, sort_order) VALUES
('RICEF',      'RICEF - Development',  1),
('BI',         'BI - Analytics',       2),
('MIGRATION',  'Migration',            3),
('FUNCTIONAL', 'Functional',           4);

-- RICEF Types (13 types with sequence ranges)
INSERT INTO ricef_types (code, label, full_label, seq_from, seq_to, sheet_type_code, sort_order) VALUES
('I', 'Interface & API',    'I - Interface & API',    1,    1999, 'RICEF',     1),
('E', 'Enhancement',        'E - Enhancement',        2000, 2999, 'RICEF',     2),
('R', 'RAP & Report',       'R - RAP & Report',       3000, 3599, 'RICEF',     3),
('P', 'Program',            'P - Program',            3600, 3799, 'RICEF',     4),
('T', 'Conversion Tool',    'T - Conversion Tool',    3800, 3999, 'MIGRATION', 5),
('U', 'Fiori UX',           'U - Fiori UX',           4000, 4499, 'RICEF',     6),
('W', 'Workflow',           'W - Workflow',            4500, 4599, 'RICEF',     7),
('F', 'Form',               'F - Form',               5000, 5999, 'RICEF',     8),
('H', 'Commerce',           'H - Commerce',           6000, 6999, 'RICEF',     9),
('B', 'BI Report',          'B - BI Report',          7000, 7999, 'BI',       10),
('C', 'Conversion',          'C - Conversion',         3900, 3999, 'RICEF',    11),
('D', 'CAP',                'D - CAP',                8000, 8099, 'RICEF',    12),
('S', 'SAP Build',          'S - SAP Build',          8100, 8199, 'RICEF',    13),
('M', 'Migration',          'M - Migration',          9000, 9999, 'MIGRATION',14);

-- Estimation Factors
INSERT INTO estimation_factors (factor_key, factor_name, calc_factor) VALUES
('FS',          'Functional Specification',  0.4),
('DEV_ANALYSIS','Development Analysis',      0.2),
('DEV_UT',      'Development & Unit Test',   1.0),
('DEV_SUP',     'Development Support',       0.1),
('FUT',         'Functional Testing',        0.4),
('BRK_FIX',     'Break Fix',                 0.1);

-- ============================================================
-- Estimation Grid (v7 values + v1 extras for missing classifications)
-- ============================================================

INSERT INTO estimation_grid VALUES (NULL,'Report Abap','ALV','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Report Abap','ALV','2-Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Report Abap','ALV','3-Medium',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Report Abap','ALV','4-High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Report Abap','ALV','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'Report Abap','Interactive','1-Very Low',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'Report Abap','Interactive','2-Low',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Report Abap','Interactive','3-Medium',60,3.6,3.6,16.8,6.0,6.0,48.0,6.0,6.0,6.0,4.8,9.6,9.6,6.0,54.0,78.0,132.0);
INSERT INTO estimation_grid VALUES (NULL,'Report Abap','Interactive','4-High',120,7.2,7.2,33.6,12.0,12.0,96.0,12.0,12.0,12.0,9.6,19.2,19.2,12.0,108.0,156.0,264.0);
INSERT INTO estimation_grid VALUES (NULL,'Report Abap','Interactive','5-Very High',180,10.8,10.8,50.4,18.0,18.0,144.0,18.0,18.0,18.0,14.4,28.8,28.8,18.0,162.0,234.0,396.0);
INSERT INTO estimation_grid VALUES (NULL,'RESTFul ABAP','Backend','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'RESTFul ABAP','Backend','2-Low',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'RESTFul ABAP','Backend','3-Medium',36,2.2,2.2,10.1,3.6,3.6,28.8,3.6,3.6,3.6,2.9,5.8,5.8,3.6,32.6,46.8,79.4);
INSERT INTO estimation_grid VALUES (NULL,'RESTFul ABAP','Backend','4-High',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'RESTFul ABAP','Backend','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'Program','Abap','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Program','Abap','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Program','Abap','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Program','Abap','4-High',64,3.8,3.8,17.9,6.4,6.4,51.2,6.4,6.4,6.4,5.1,10.2,10.2,6.4,57.4,83.2,140.6);
INSERT INTO estimation_grid VALUES (NULL,'Program','Abap','5-Very High',128,7.7,7.7,35.8,12.8,12.8,102.4,12.8,12.8,12.8,10.2,20.5,20.5,12.8,115.2,166.4,281.6);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Inbound','1-Very Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Inbound','2-Low',64,3.8,3.8,17.9,6.4,6.4,51.2,6.4,6.4,6.4,5.1,10.2,10.2,6.4,57.4,83.2,140.6);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Inbound','3-Medium',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Inbound','4-High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Inbound','5-Very High',240,14.4,14.4,67.2,24.0,24.0,192.0,24.0,24.0,24.0,19.2,38.4,38.4,24.0,216.0,312.0,528.0);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Outbound','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Outbound','2-Low',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Outbound','3-Medium',64,3.8,3.8,17.9,6.4,6.4,51.2,6.4,6.4,6.4,5.1,10.2,10.2,6.4,57.4,83.2,140.6);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Outbound','4-High',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'Interface Abap','Outbound','5-Very High',128,7.7,7.7,35.8,12.8,12.8,102.4,12.8,12.8,12.8,10.2,20.5,20.5,12.8,115.2,166.4,281.6);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Extract-Load','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Extract-Load','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Extract-Load','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Extract-Load','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Extract-Load','5-Very High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Mapping','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Mapping','2-Low',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Mapping','3-Medium',40,2.4,2.4,11.2,4.0,4.0,32.0,4.0,4.0,4.0,3.2,6.4,6.4,4.0,36.0,52.0,88.0);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Mapping','4-High',64,3.8,3.8,17.9,6.4,6.4,51.2,6.4,6.4,6.4,5.1,10.2,10.2,6.4,57.4,83.2,140.6);
INSERT INTO estimation_grid VALUES (NULL,'Process Integration','Mapping','5-Very High',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Extract-Load','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Extract-Load','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Extract-Load','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Extract-Load','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Extract-Load','5-Very High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Mapping','1-Very Low',1,0.1,0.1,0.3,0.1,0.1,0.8,0.1,0.1,0.1,0.1,0.2,0.2,0.1,1.1,1.3,2.4);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Mapping','2-Low',4,0.2,0.2,1.1,0.4,0.4,3.2,0.4,0.4,0.4,0.3,0.6,0.6,0.4,3.4,5.2,8.6);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Mapping','3-Medium',40,2.4,2.4,11.2,4.0,4.0,32.0,4.0,4.0,4.0,3.2,6.4,6.4,4.0,36.0,52.0,88.0);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Mapping','4-High',56,3.4,3.4,15.7,5.6,5.6,44.8,5.6,5.6,5.6,4.5,9.0,9.0,5.6,50.6,72.8,123.4);
INSERT INTO estimation_grid VALUES (NULL,'PI Migration','Mapping','5-Very High',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Extract-Load','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Extract-Load','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Extract-Load','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Extract-Load','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Extract-Load','5-Very High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Mapping','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Mapping','2-Low',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Mapping','3-Medium',40,2.4,2.4,11.2,4.0,4.0,32.0,4.0,4.0,4.0,3.2,6.4,6.4,4.0,36.0,52.0,88.0);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Mapping','4-High',56,3.4,3.4,15.7,5.6,5.6,44.8,5.6,5.6,5.6,4.5,9.0,9.0,5.6,50.6,72.8,123.4);
INSERT INTO estimation_grid VALUES (NULL,'CPI','Mapping','5-Very High',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Load','1-Very Low',14,0.8,0.8,3.9,1.4,1.4,11.2,1.4,1.4,1.4,1.1,2.2,2.2,1.4,12.4,18.2,30.6);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Load','2-Low',26,1.6,1.6,7.3,2.6,2.6,20.8,2.6,2.6,2.6,2.1,4.2,4.2,2.6,23.6,33.8,57.4);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Load','3-Medium',39,2.3,2.3,10.9,3.9,3.9,31.2,3.9,3.9,3.9,3.1,6.2,6.2,3.9,34.9,50.7,85.6);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Load','4-High',78,4.7,4.7,21.8,7.8,7.8,62.4,7.8,7.8,7.8,6.2,12.5,12.5,7.8,70.2,101.4,171.6);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Load','5-Very High',130,7.8,7.8,36.4,13.0,13.0,104.0,13.0,13.0,13.0,10.4,20.8,20.8,13.0,117.0,169.0,286.0);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Support Functional','1-Very Low',20,1.2,1.2,5.6,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,3.2,0.0,11.2,0.0,11.2);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Support Functional','2-Low',40,2.4,2.4,11.2,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,6.4,0.0,22.4,0.0,22.4);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Support Functional','3-Medium',80,4.8,4.8,22.4,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,12.8,0.0,44.8,0.0,44.8);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Support Functional','4-High',160,9.6,9.6,44.8,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,25.6,0.0,89.6,0.0,89.6);
INSERT INTO estimation_grid VALUES (NULL,'Conversion','Support Functional','5-Very High',320,19.2,19.2,89.6,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,51.2,0.0,179.2,0.0,179.2);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Modification','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Modification','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Modification','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Modification','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Modification','5-Very High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','InApp','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','InApp','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','InApp','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','InApp','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','InApp','5-Very High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Extract-Load','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Extract-Load','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Extract-Load','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Extract-Load','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','Extract-Load','5-Very High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','CDS View','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','CDS View','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','CDS View','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','CDS View','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Enhancement','CDS View','5-Very High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Form','Standard','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Form','Standard','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Form','Standard','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Form','Standard','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Form','Standard','5-Very High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Fiori Element','1-Very Low',12,0.7,0.7,3.4,1.2,1.2,9.6,1.2,1.2,1.2,1.0,1.9,1.9,1.2,10.8,15.6,26.4);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Fiori Element','2-Low',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Fiori Element','3-Medium',30,1.8,1.8,8.4,3.0,3.0,24.0,3.0,3.0,3.0,2.4,4.8,4.8,3.0,27.0,39.0,66.0);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Fiori Element','4-High',60,3.6,3.6,16.8,6.0,6.0,48.0,6.0,6.0,6.0,4.8,9.6,9.6,6.0,54.0,78.0,132.0);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Fiori Element','5-Very High',120,7.2,7.2,33.6,12.0,12.0,96.0,12.0,12.0,12.0,9.6,19.2,19.2,12.0,108.0,156.0,264.0);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Freestyle','1-Very Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Freestyle','2-Low',64,3.8,3.8,17.9,6.4,6.4,51.2,6.4,6.4,6.4,5.1,10.2,10.2,6.4,57.4,83.2,140.6);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Freestyle','3-Medium',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Freestyle','4-High',192,11.5,11.5,53.8,19.2,19.2,153.6,19.2,19.2,19.2,15.4,30.7,30.7,19.2,172.8,249.6,422.4);
INSERT INTO estimation_grid VALUES (NULL,'Fiori','FE - Freestyle','5-Very High',320,19.2,19.2,89.6,32.0,32.0,256.0,32.0,32.0,32.0,25.6,51.2,51.2,32.0,288.0,416.0,704.0);
INSERT INTO estimation_grid VALUES (NULL,'Fiori Extension','Frontend','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Fiori Extension','Frontend','2-Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Fiori Extension','Frontend','3-Medium',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Fiori Extension','Frontend','4-High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Fiori Extension','Frontend','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Flexible','1-Very Low',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Flexible','2-Low',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Flexible','3-Medium',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Flexible','4-High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Flexible','5-Very High',240,14.4,14.4,67.2,24.0,24.0,192.0,24.0,24.0,24.0,19.2,38.4,38.4,24.0,216.0,312.0,528.0);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Standard','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Standard','2-Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Standard','3-Medium',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Standard','4-High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Workflow','Standard','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Story','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Story','2-Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Story','3-Medium',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Story','4-High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Story','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Analysis','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Analysis','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Analysis','3-Medium',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Analysis','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'BI FE','Analysis','5-Very High',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Standard','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Standard','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Standard','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Standard','4-High',64,3.8,3.8,17.9,6.4,6.4,51.2,6.4,6.4,6.4,5.1,10.2,10.2,6.4,57.4,83.2,140.6);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Standard','5-Very High',128,7.7,7.7,35.8,12.8,12.8,102.4,12.8,12.8,12.8,10.2,20.5,20.5,12.8,115.2,166.4,281.6);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Planning','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Planning','2-Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Planning','3-Medium',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Planning','4-High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'BI Model','Planning','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'BI BE','CDS View','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'BI BE','CDS View','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'BI BE','CDS View','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'BI BE','CDS View','4-High',64,3.8,3.8,17.9,6.4,6.4,51.2,6.4,6.4,6.4,5.1,10.2,10.2,6.4,57.4,83.2,140.6);
INSERT INTO estimation_grid VALUES (NULL,'BI BE','CDS View','5-Very High',128,7.7,7.7,35.8,12.8,12.8,102.4,12.8,12.8,12.8,10.2,20.5,20.5,12.8,115.2,166.4,281.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Extraction','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Extraction','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Extraction','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Extraction','4-High',64,3.8,3.8,17.9,6.4,6.4,51.2,6.4,6.4,6.4,5.1,10.2,10.2,6.4,57.4,83.2,140.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Extraction','5-Very High',128,7.7,7.7,35.8,12.8,12.8,102.4,12.8,12.8,12.8,10.2,20.5,20.5,12.8,115.2,166.4,281.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cleansing','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cleansing','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cleansing','3-Medium',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cleansing','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cleansing','5-Very High',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Development','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Development','2-Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Development','3-Medium',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Development','4-High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Development','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Mock Load QA','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Mock Load QA','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Mock Load QA','3-Medium',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Mock Load QA','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Mock Load QA','5-Very High',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cutover','1-Very Low',4,0.2,0.2,1.1,0.4,0.4,3.2,0.4,0.4,0.4,0.3,0.6,0.6,0.4,3.6,5.2,8.8);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cutover','2-Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cutover','3-Medium',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cutover','4-High',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Migration','Cutover','5-Very High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Frontend','1-Very Low',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Frontend','2-Low',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Frontend','3-Medium',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Frontend','4-High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Frontend','5-Very High',240,14.4,14.4,67.2,24.0,24.0,192.0,24.0,24.0,24.0,19.2,38.4,38.4,24.0,216.0,312.0,528.0);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Service','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Service','2-Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Service','3-Medium',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Service','4-High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'CAP','Service','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'CAP','DB','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'CAP','DB','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'CAP','DB','3-Medium',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'CAP','DB','4-High',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'CAP','DB','5-Very High',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'SAP Build','App','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'SAP Build','App','2-Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'SAP Build','App','3-Medium',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'SAP Build','App','4-High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'SAP Build','App','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'Build','BuildApp FE','1-Very Low',24,1.4,1.4,6.7,2.4,2.4,19.2,2.4,2.4,2.4,1.9,3.8,3.8,2.4,21.4,31.2,52.6);
INSERT INTO estimation_grid VALUES (NULL,'Build','BuildApp FE','2-Low',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Build','BuildApp FE','3-Medium',80,4.8,4.8,22.4,8.0,8.0,64.0,8.0,8.0,8.0,6.4,12.8,12.8,8.0,72.0,104.0,176.0);
INSERT INTO estimation_grid VALUES (NULL,'Build','BuildApp FE','4-High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'Build','BuildApp FE','5-Very High',240,14.4,14.4,67.2,24.0,24.0,192.0,24.0,24.0,24.0,19.2,38.4,38.4,24.0,216.0,312.0,528.0);
INSERT INTO estimation_grid VALUES (NULL,'Build','Process Automation','1-Very Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Build','Process Automation','2-Low',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Build','Process Automation','3-Medium',48,2.9,2.9,13.4,4.8,4.8,38.4,4.8,4.8,4.8,3.8,7.7,7.7,4.8,43.2,62.4,105.6);
INSERT INTO estimation_grid VALUES (NULL,'Build','Process Automation','4-High',96,5.8,5.8,26.9,9.6,9.6,76.8,9.6,9.6,9.6,7.7,15.4,15.4,9.6,86.6,124.8,211.4);
INSERT INTO estimation_grid VALUES (NULL,'Build','Process Automation','5-Very High',160,9.6,9.6,44.8,16.0,16.0,128.0,16.0,16.0,16.0,12.8,25.6,25.6,16.0,144.0,208.0,352.0);
INSERT INTO estimation_grid VALUES (NULL,'Build','RPA','1-Very Low',8,0.5,0.5,2.2,0.8,0.8,6.4,0.8,0.8,0.8,0.6,1.3,1.3,0.8,7.2,10.4,17.6);
INSERT INTO estimation_grid VALUES (NULL,'Build','RPA','2-Low',16,1.0,1.0,4.5,1.6,1.6,12.8,1.6,1.6,1.6,1.3,2.6,2.6,1.6,14.6,20.8,35.4);
INSERT INTO estimation_grid VALUES (NULL,'Build','RPA','3-Medium',32,1.9,1.9,9.0,3.2,3.2,25.6,3.2,3.2,3.2,2.6,5.1,5.1,3.2,28.8,41.6,70.4);
INSERT INTO estimation_grid VALUES (NULL,'Build','RPA','4-High',64,3.8,3.8,17.9,6.4,6.4,51.2,6.4,6.4,6.4,5.1,10.2,10.2,6.4,57.4,83.2,140.6);
INSERT INTO estimation_grid VALUES (NULL,'Build','RPA','5-Very High',128,7.7,7.7,35.8,12.8,12.8,102.4,12.8,12.8,12.8,10.2,20.5,20.5,12.8,115.2,166.4,281.6);


-- ============================================================
-- Blended Rate Configuration
-- ============================================================

-- (D) DEV team
INSERT INTO blended_rate_configs (team_prefix, team_label) VALUES ('(D)', 'DEV');
INSERT INTO blended_effort_by_complexity (config_id, complexity, multiplier) VALUES
(1, '1-Very Low', 1.34), (1, '2-Low', 1.34), (1, '3-Medium', 1.19), (1, '4-High', 1.08), (1, '5-Very High', 1.02);

INSERT INTO blended_delivery_levels (config_id, level_number, level_label) VALUES
(1, 1, '1 : Minimal Adaptation'), (1, 2, '2 : Balanced Delivery'), (1, 3, '3 : Expertise driven Adaptation');

INSERT INTO blended_rates (level_id, currency, billable_rate, effort_multiplier, blended_cost, margin_pct) VALUES
(1, 'USD', 100, 1.30, 39.80, 0.602),  (1, 'CAD', 140, 1.30, 55.52, 0.603),  (1, 'EUR', 87, 1.30, 34.11, 0.608),
(2, 'USD', 115, 1.26, 44.75, 0.611),  (2, 'CAD', 160, 1.26, 62.42, 0.610),  (2, 'EUR', 97, 1.26, 38.35, 0.605),
(3, 'USD', 140, 1.16, 55.88, 0.601),  (3, 'CAD', 195, 1.16, 77.95, 0.600),  (3, 'EUR', 120, 1.16, 47.89, 0.601);

-- (B) BI team
INSERT INTO blended_rate_configs (team_prefix, team_label) VALUES ('(B)', 'BI');
INSERT INTO blended_effort_by_complexity (config_id, complexity, multiplier) VALUES
(2, '1-Very Low', 1.34), (2, '2-Low', 1.34), (2, '3-Medium', 1.19), (2, '4-High', 1.08), (2, '5-Very High', 1.02);

INSERT INTO blended_delivery_levels (config_id, level_number, level_label) VALUES
(2, 1, '1 : Minimal Adaptation'), (2, 2, '2 : Balanced Delivery'), (2, 3, '3 : Expertise driven Adaptation');

INSERT INTO blended_rates (level_id, currency, billable_rate, effort_multiplier, blended_cost, margin_pct) VALUES
(4, 'USD', 100, 1.30, 39.80, 0.602),  (4, 'CAD', 140, 1.30, 55.52, 0.603),  (4, 'EUR', 87, 1.30, 34.11, 0.608),
(5, 'USD', 115, 1.26, 44.75, 0.611),  (5, 'CAD', 160, 1.26, 62.42, 0.610),  (5, 'EUR', 97, 1.26, 38.35, 0.605),
(6, 'USD', 140, 1.16, 55.88, 0.601),  (6, 'CAD', 195, 1.16, 77.95, 0.600),  (6, 'EUR', 120, 1.16, 47.89, 0.601);

-- (M) Migration team
INSERT INTO blended_rate_configs (team_prefix, team_label) VALUES ('(M)', 'MIGRATION');
INSERT INTO blended_effort_by_complexity (config_id, complexity, multiplier) VALUES
(3, '1-Very Low', 1.34), (3, '2-Low', 1.34), (3, '3-Medium', 1.19), (3, '4-High', 1.08), (3, '5-Very High', 1.02);

INSERT INTO blended_delivery_levels (config_id, level_number, level_label) VALUES
(3, 1, '1 : Minimal Adaptation'), (3, 2, '2 : Balanced Delivery'), (3, 3, '3 : Expertise driven Adaptation');

INSERT INTO blended_rates (level_id, currency, billable_rate, effort_multiplier, blended_cost, margin_pct) VALUES
(7, 'USD', 100, 1.30, 39.80, 0.602),  (7, 'CAD', 140, 1.30, 55.52, 0.603),  (7, 'EUR', 87, 1.30, 34.11, 0.608),
(8, 'USD', 115, 1.26, 44.75, 0.611),  (8, 'CAD', 160, 1.26, 62.42, 0.610),  (8, 'EUR', 97, 1.26, 38.35, 0.605),
(9, 'USD', 140, 1.16, 55.88, 0.601),  (9, 'CAD', 195, 1.16, 77.95, 0.600),  (9, 'EUR', 120, 1.16, 47.89, 0.601);

-- ============================================================
-- Complexity Definitions (Migration)
-- ============================================================
INSERT INTO complexity_definitions (team, classification_group, subgroup,
    func_very_low, func_low, func_medium, func_high, func_very_high,
    tech_very_low, tech_low, tech_medium, tech_high, tech_very_high)
VALUES ('MIGRATION', 'Migration', 'Development', 13,15,30,45,60, 12,24,58,92,144);

INSERT INTO complexity_factors (definition_id, factor_name, value_very_low, value_low, value_medium, value_high, value_very_high, sort_order) VALUES
(1, 'Transformation logic',      'None',    'Simple',  'Moderate', 'Complex',          'Algorithmic / Very Complex', 1),
(1, 'Number of target/staging tables', '1', '1 to 2',  '2 to 4',  '4 to 6',           '6+',                        2),
(1, 'Dependencies',              'None',    'Weak',    'Moderate', 'Strong',           'Circular',                   3),
(1, 'Validation type',           'Minimal', 'Minimal', 'Minimal',  'Industry Specific','Regulatory',                4),
(1, 'Reusability',               'One-off', 'Minor',   'Shared',   'Multi-wave',       'Enterprise-wide',           5);

-- ============================================================
-- Dropdown Categories and Values
-- ============================================================

-- Status
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('STATUS', 'Object Status', 1);
INSERT INTO dropdown_values (category_id, value, sort_order) VALUES
(1,'New',1),(1,'Modified',2),(1,'In Review',3),(1,'Confirmed',4),(1,'Cancelled',5);

-- Responsible
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('RESPONSIBLE', 'Responsible', 1);
INSERT INTO dropdown_values (category_id, value, sort_order) VALUES
(2,'SYNTAX',1),(2,'CUSTOMER',2);

-- Complexity
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('COMPLEXITY', 'Complexities', 1);
INSERT INTO dropdown_values (category_id, value, sort_order) VALUES
(3,'0-TBD',1),(3,'1-Very Low',2),(3,'2-Low',3),(3,'3-Medium',4),(3,'4-High',5),(3,'5-Very High',6);

-- Module
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('MODULE', 'Module', 1);
INSERT INTO dropdown_values (category_id, value, sort_order) VALUES
(4,'ALL',1),(4,'CO',2),(4,'EWM',3),(4,'FI',4),(4,'GK',5),(4,'IM',6),(4,'LE',7),
(4,'MD',8),(4,'OAA',9),(4,'OPP',10),(4,'OTC',11),(4,'PM',12),(4,'POSDTA',13),
(4,'PP',14),(4,'PS',15),(4,'PTP',16),(4,'QM',17);

-- Functional Role
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('FUNC_ROLE', 'Functional Role', 1);
INSERT INTO dropdown_values (category_id, value, sort_order) VALUES
(5,'ALL Analyst',1),(5,'Commerce Analyst',2),(5,'CO Analyst',3),(5,'EWM Analyst',4),
(5,'FI Analyst',5),(5,'LE Analyst',6),(5,'MD Analyst',7),(5,'OTC Analyst',8),
(5,'PM Analyst',9),(5,'PP Analyst',10),(5,'PS Analyst',11),(5,'PTP Analyst',12);

-- Tech Role DEV
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('TECH_ROLE_DEV', 'Tech Role (DEV)', 1);
INSERT INTO dropdown_values (category_id, value, sort_order) VALUES
(6,'(D) Abap Developer',1),(6,'(D) CPI Developer',2),(6,'(D) Fiori Developer',3),
(6,'(D) CAP Developer',4),(6,'(D) SAP Build Developer',5),(6,'(D) Customer Developer',6);

-- Tech Role BI
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('TECH_ROLE_BI', 'Tech Role (BI)', 1);
INSERT INTO dropdown_values (category_id, value, sort_order) VALUES
(7,'(B) BI Developer',1),(7,'(B) Customer Developer',2);

-- Tech Role Migration
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('TECH_ROLE_MIG', 'Tech Role (Migration)', 1);
INSERT INTO dropdown_values (category_id, value, sort_order) VALUES
(8,'(M) Migration Developer',1),(8,'(M) Customer Developer',2);

-- Classification DEV
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('CLASSIFICATION_DEV', 'Classification (DEV)', 1);
INSERT INTO dropdown_values (category_id, value, sort_order, is_separator) VALUES
(9,'TOTAL',1,0),
(9,'------ Interface -------',2,1),
(9,'CPI / Mapping',3,0),
(9,'PI Migration / Mapping',4,0),
(9,'----- Enhancement -------',5,1),
(9,'Enhancement / Modification',6,0),
(9,'Enhancement / InApp',7,0),
(9,'Enhancement / Extract-Load',8,0),
(9,'Enhancement / CDS View',9,0),
(9,'----- Fiori UX -------',10,1),
(9,'Fiori / FE - Fiori Element',11,0),
(9,'Fiori / FE - Freestyle',12,0),
(9,'Fiori Extension / Frontend',13,0),
(9,'----- Form -------',14,1),
(9,'Form / Standard',15,0),
(9,'------ REST & Report -------',16,1),
(9,'RESTFul ABAP / Backend',17,0),
(9,'Report Abap / ALV',18,0),
(9,'Report Abap / Interactive',19,0),
(9,'----- Workflow -------',20,1),
(9,'Workflow / Flexible',21,0),
(9,'Workflow / Standard',22,0),
(9,'----- Program -------',23,1),
(9,'Program / Abap',24,0),
(9,'----- CAP -------',25,1),
(9,'CAP / Frontend',26,0),
(9,'CAP / Service',27,0),
(9,'CAP / DB',28,0),
(9,'----- Conversion -------',29,1),
(9,'Conversion / Support Functional',30,0),
(9,'----- SAP Build -------',31,1),
(9,'SAP Build / App',32,0),
(9,'Build / BuildApp FE',33,0),
(9,'Build / Process Automation',34,0),
(9,'Build / RPA',35,0),
(9,'----- Interface Abap -------',36,1),
(9,'Interface Abap / Inbound',37,0),
(9,'Interface Abap / Outbound',38,0),
(9,'Process Integration / Extract-Load',39,0);

-- Classification BI
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('CLASSIFICATION_BI', 'Classification (BI)', 1);
INSERT INTO dropdown_values (category_id, value, sort_order, is_separator) VALUES
(10,'TOTAL',1,0),
(10,'----- BI Report -------',2,1),
(10,'BI FE / Story',3,0),
(10,'BI FE / Analysis',4,0),
(10,'BI Model / Standard',5,0),
(10,'BI Model / Planning',6,0),
(10,'BI BE / CDS View',7,0);

-- Classification MIGRATION
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('CLASSIFICATION_MIG', 'Classification (Migration)', 1);
INSERT INTO dropdown_values (category_id, value, sort_order, is_separator) VALUES
(11,'TOTAL',1,0),
(11,'----- Migration -------',2,1),
(11,'Migration / Extraction',3,0),
(11,'Migration / Cleansing',4,0),
(11,'Migration / Development',5,0),
(11,'Migration / Mock Load QA',6,0),
(11,'Migration / Cutover',7,0);

-- Location
INSERT INTO dropdown_categories (code, label, is_system) VALUES ('LOCATION', 'Location', 0);
INSERT INTO dropdown_values (category_id, value, sort_order) VALUES
(12,'ON.',1),(12,'NE.',2),(12,'OF.',3),(12,'DC.',4);

-- ============================================================
-- Sheet Column Config (RICEF sheet)
-- ============================================================
INSERT INTO sheet_column_config (sheet_type_code, column_key, column_label, data_type, dropdown_code, is_visible, is_editable, sort_order, width) VALUES
('RICEF','backlog_number',   'Backlog #',        'text',    NULL,                1,1, 1, '8rem'),
('RICEF','architecture_ref', 'Architecture #',   'text',    NULL,                1,1, 2, '10rem'),
('RICEF','tsa_group',        'TSA Group',        'number',  NULL,                1,1, 3, '5rem'),
('RICEF','tsa_process',      'TSA Process',      'text',    NULL,                1,1, 4, '8rem'),
('RICEF','special_notes',    'Special Notes',    'text',    NULL,                1,1, 5, '12rem'),
('RICEF','predecessor',      'Predecessor',      'text',    NULL,                1,1, 6, '8rem'),
('RICEF','seq_number',       'Seq #',            'number',  NULL,                1,0, 7, '5rem'),
('RICEF','module',           'Module',           'dropdown','MODULE',            1,1, 8, '6rem'),
('RICEF','ricef_number',     'RICEF #',          'text',    NULL,                1,0, 9, '10rem'),
('RICEF','description',      'Description',      'text',    NULL,                1,1,10, '20rem'),
('RICEF','design_notes',     'Design Notes HLD', 'text',    NULL,                1,1,11, '15rem'),
('RICEF','status',           'RICEF Status',     'dropdown','STATUS',            1,1,12, '8rem'),
('RICEF','func_effort_adj',  'FUNC Effort ADJ',  'number',  NULL,                1,1,13, '6rem'),
('RICEF','func_team',        'FUNC Team',        'dropdown','RESPONSIBLE',       1,1,14, '7rem'),
('RICEF','func_role',        'FUNC Role',        'dropdown','FUNC_ROLE',         1,1,15, '10rem'),
('RICEF','tech_effort_adj',  'TECH Effort ADJ',  'number',  NULL,                1,1,16, '6rem'),
('RICEF','tech_team',        'TECH Team',        'dropdown','RESPONSIBLE',       1,1,17, '7rem'),
('RICEF','tech_role',        'TECH Role',        'dropdown','TECH_ROLE_DEV',     1,1,18, '12rem'),
('RICEF','object_type',      'Object Type',      'text',    NULL,                1,0,19, '12rem'),
('RICEF','classification',   'Classification',   'dropdown','CLASSIFICATION_DEV',1,1,20, '14rem'),
('RICEF','complexity',       'Complexity',       'dropdown','COMPLEXITY',        1,1,21, '8rem'),
('RICEF','blended_multiplier','Blended Mult.',   'number',  NULL,                1,0,22, '6rem'),
('RICEF','sub_items_func',  'SUB Items FUNC',   'number',  NULL,                1,0,23, '6rem'),
('RICEF','sub_items_tech',  'SUB Items TECH',   'number',  NULL,                1,0,24, '6rem'),
('RICEF','build_func',      '(BUILD) FUNC',     'number',  NULL,                1,0,25, '7rem'),
('RICEF','build_tech',      '(BUILD) TECH',     'number',  NULL,                1,0,26, '7rem'),
('RICEF','sit_func',        '(SIT) FUNC',       'number',  NULL,                1,0,27, '6rem'),
('RICEF','sit_tech',        '(SIT) TECH',       'number',  NULL,                1,0,28, '6rem'),
('RICEF','total_func_hours', 'Total FUNC',       'number',  NULL,                1,0,29, '7rem'),
('RICEF','total_tech_hours', 'Total TECH',       'number',  NULL,                1,0,30, '7rem'),
('RICEF','grand_total_hours','Grand Total',      'number',  NULL,                1,0,31, '7rem');

-- Sheet Column Config (BI sheet - same structure, different dropdowns)
INSERT INTO sheet_column_config (sheet_type_code, column_key, column_label, data_type, dropdown_code, is_visible, is_editable, sort_order, width) VALUES
('BI','backlog_number','Backlog #','text',NULL,1,1,1,'8rem'),
('BI','seq_number','Seq #','number',NULL,1,0,2,'5rem'),
('BI','module','Module','dropdown','MODULE',1,1,3,'6rem'),
('BI','ricef_number','RICEF #','text',NULL,1,0,4,'10rem'),
('BI','description','Description','text',NULL,1,1,5,'20rem'),
('BI','status','Status','dropdown','STATUS',1,1,6,'8rem'),
('BI','func_effort_adj','FUNC Effort ADJ','number',NULL,1,1,7,'6rem'),
('BI','func_team','FUNC Team','dropdown','RESPONSIBLE',1,1,8,'7rem'),
('BI','tech_effort_adj','TECH Effort ADJ','number',NULL,1,1,9,'6rem'),
('BI','tech_role','TECH Role','dropdown','TECH_ROLE_BI',1,1,10,'12rem'),
('BI','classification','Classification','dropdown','CLASSIFICATION_BI',1,1,11,'14rem'),
('BI','complexity','Complexity','dropdown','COMPLEXITY',1,1,12,'8rem'),
('BI','blended_multiplier','Blended Mult.','number',NULL,1,0,13,'6rem'),
('BI','sub_items_func','SUB Items FUNC','number',NULL,1,0,14,'6rem'),
('BI','sub_items_tech','SUB Items TECH','number',NULL,1,0,15,'6rem'),
('BI','build_func','(BUILD) FUNC','number',NULL,1,0,16,'7rem'),
('BI','build_tech','(BUILD) TECH','number',NULL,1,0,17,'7rem'),
('BI','sit_func','(SIT) FUNC','number',NULL,1,0,18,'6rem'),
('BI','sit_tech','(SIT) TECH','number',NULL,1,0,19,'6rem'),
('BI','total_func_hours','Total FUNC','number',NULL,1,0,20,'7rem'),
('BI','total_tech_hours','Total TECH','number',NULL,1,0,21,'7rem'),
('BI','grand_total_hours','Grand Total','number',NULL,1,0,22,'7rem');

-- Sheet Column Config (MIGRATION sheet)
INSERT INTO sheet_column_config (sheet_type_code, column_key, column_label, data_type, dropdown_code, is_visible, is_editable, sort_order, width) VALUES
('MIGRATION','backlog_number','Backlog #','text',NULL,1,1,1,'8rem'),
('MIGRATION','seq_number','Seq #','number',NULL,1,0,2,'5rem'),
('MIGRATION','module','Module','dropdown','MODULE',1,1,3,'6rem'),
('MIGRATION','ricef_number','RICEF #','text',NULL,1,0,4,'10rem'),
('MIGRATION','description','Description','text',NULL,1,1,5,'20rem'),
('MIGRATION','status','Status','dropdown','STATUS',1,1,6,'8rem'),
('MIGRATION','func_effort_adj','FUNC Effort ADJ','number',NULL,1,1,7,'6rem'),
('MIGRATION','func_team','FUNC Team','dropdown','RESPONSIBLE',1,1,8,'7rem'),
('MIGRATION','tech_effort_adj','TECH Effort ADJ','number',NULL,1,1,9,'6rem'),
('MIGRATION','tech_role','TECH Role','dropdown','TECH_ROLE_MIG',1,1,10,'12rem'),
('MIGRATION','classification','Classification','dropdown','CLASSIFICATION_MIG',1,1,11,'14rem'),
('MIGRATION','complexity','Complexity','dropdown','COMPLEXITY',1,1,12,'8rem'),
('MIGRATION','blended_multiplier','Blended Mult.','number',NULL,1,0,13,'6rem'),
('MIGRATION','sub_items_func','SUB Items FUNC','number',NULL,1,0,14,'6rem'),
('MIGRATION','sub_items_tech','SUB Items TECH','number',NULL,1,0,15,'6rem'),
('MIGRATION','build_func','(BUILD) FUNC','number',NULL,1,0,16,'7rem'),
('MIGRATION','build_tech','(BUILD) TECH','number',NULL,1,0,17,'7rem'),
('MIGRATION','sit_func','(SIT) FUNC','number',NULL,1,0,18,'6rem'),
('MIGRATION','sit_tech','(SIT) TECH','number',NULL,1,0,19,'6rem'),
('MIGRATION','total_func_hours','Total FUNC','number',NULL,1,0,20,'7rem'),
('MIGRATION','total_tech_hours','Total TECH','number',NULL,1,0,21,'7rem'),
('MIGRATION','grand_total_hours','Grand Total','number',NULL,1,0,22,'7rem');
