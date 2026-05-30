const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let _pool;

function getPool() {
  if (_pool) return _pool;

  let config;

  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const pgService = (vcap['postgresql-db'] || vcap.postgresql || [])[0];
    if (pgService) {
      const creds = pgService.credentials;
      config = {
        host: creds.hostname || creds.host,
        port: creds.port,
        database: creds.dbname || creds.database,
        user: creds.username || creds.user,
        password: creds.password,
        ssl: creds.sslcert ? { ca: creds.sslcert } : { rejectUnauthorized: false },
        max: 10
      };
    }
  }

  if (!config) {
    config = {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'ricef_builder',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      max: 10
    };
  }

  _pool = new Pool(config);
  return _pool;
}

async function initDb() {
  const pool = getPool();

  const tableCheck = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'projects'"
  );

  if (tableCheck.rows.length === 0) {
    console.log('Initializing database schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);

    console.log('Seeding reference data...');
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await pool.query(seed);

    const samplePath = path.join(__dirname, 'seed-sample-project.sql');
    if (fs.existsSync(samplePath)) {
      console.log('Seeding sample project...');
      const sampleSeed = fs.readFileSync(samplePath, 'utf8');
      await pool.query(sampleSeed);
    }

    await seedComplexityFactors(pool);
    console.log('Database initialized.');
  } else {
    console.log('Database already exists, checking migrations...');
    const pmCheck = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_members'"
    );
    if (pmCheck.rows.length === 0) {
      console.log('Creating project_members table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_members (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          user_email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          added_by TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_unique ON project_members(project_id, user_email);
        CREATE INDEX IF NOT EXISTS idx_pm_email ON project_members(user_email);
      `);
      console.log('project_members table created.');
    }

    await seedComplexityFactors(pool);
    await migrateBlendedTeamTables(pool);
  }
}

async function migrateBlendedTeamTables(pool) {
  const tblCheck = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='blended_complexity_dist'"
  );
  if (tblCheck.rows.length === 0) {
    console.log('Creating blended_complexity_dist and blended_team_composition tables...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blended_complexity_dist (
        id SERIAL PRIMARY KEY, config_id INTEGER NOT NULL, level_number INTEGER NOT NULL,
        pct_low DOUBLE PRECISION NOT NULL DEFAULT 0, pct_med DOUBLE PRECISION NOT NULL DEFAULT 0,
        pct_high DOUBLE PRECISION NOT NULL DEFAULT 0, pct_vhigh DOUBLE PRECISION NOT NULL DEFAULT 0,
        FOREIGN KEY (config_id) REFERENCES blended_rate_configs(id) ON DELETE CASCADE);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bcd ON blended_complexity_dist(config_id, level_number);
      CREATE TABLE IF NOT EXISTS blended_team_composition (
        id SERIAL PRIMARY KEY, config_id INTEGER NOT NULL, level_number INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0, multi DOUBLE PRECISION NOT NULL DEFAULT 0,
        complexity TEXT NOT NULL, individual TEXT NOT NULL,
        weight DOUBLE PRECISION NOT NULL DEFAULT 0, col_ref INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (config_id) REFERENCES blended_rate_configs(id) ON DELETE CASCADE);
      CREATE INDEX IF NOT EXISTS idx_btc ON blended_team_composition(config_id, level_number);
    `);
  }

  const { rows } = await pool.query('SELECT count(*) AS cnt FROM blended_complexity_dist');
  if (parseInt(rows[0].cnt) > 0) return;

  console.log('Seeding blended complexity distribution and team composition...');
  const DIST = [
    // (D) config_id=1
    { c:1, l:1, low:80, med:10, high:10, vh:0 },
    { c:1, l:2, low:60, med:20, high:15, vh:5 },
    { c:1, l:3, low:10, med:51, high:29, vh:10 },
    // (B) config_id=2
    { c:2, l:1, low:80, med:10, high:10, vh:0 },
    { c:2, l:2, low:60, med:20, high:15, vh:5 },
    { c:2, l:3, low:10, med:21, high:59, vh:10 },
    // (M) config_id=3
    { c:3, l:1, low:80, med:10, high:10, vh:0 },
    { c:3, l:2, low:60, med:20, high:15, vh:5 },
    { c:3, l:3, low:10, med:21, high:59, vh:10 }
  ];
  for (const d of DIST) {
    await pool.query(
      'INSERT INTO blended_complexity_dist (config_id,level_number,pct_low,pct_med,pct_high,pct_vhigh) VALUES ($1,$2,$3,$4,$5,$6)',
      [d.c, d.l, d.low, d.med, d.high, d.vh]
    );
  }

  // Team composition: [config_id, level, sort, multi, complexity, individual, weight, col]
  const TEAM = [
    // (D) Level 1
    [1,1,1,80,'Low','Low-Med.DC.Jr',0.80,17],[1,1,2,80,'Low','Low-Med.OF.In',0.20,16],
    [1,1,3,10,'Med','Low-Med.DC.Jr',0.30,17],[1,1,4,10,'Med','Low-Med.OF.In',0.35,16],[1,1,5,10,'Med','Low-Med.ON.In',0.35,12],
    [1,1,6,10,'High','High-VHigh.ON.Sr',0.80,21],[1,1,7,10,'High','High-VHigh.ON.Ar',0.20,22],
    [1,1,8,0,'VHigh','High-VHigh.ON.Sr',0.20,21],[1,1,9,0,'VHigh','High-VHigh.ON.Ar',0.80,22],
    // (D) Level 2
    [1,2,1,60,'Low','Low-Med.DC.Jr',0.80,17],[1,2,2,60,'Low','Low-Med.OF.In',0.20,16],
    [1,2,3,20,'Med','Low-Med.DC.Jr',0.30,17],[1,2,4,20,'Med','Low-Med.OF.In',0.35,16],[1,2,5,20,'Med','Low-Med.ON.In',0.35,12],
    [1,2,6,15,'High','High-VHigh.ON.Sr',0.80,21],[1,2,7,15,'High','High-VHigh.ON.Ar',0.20,22],
    [1,2,8,5,'VHigh','High-VHigh.ON.Sr',0.20,21],[1,2,9,5,'VHigh','High-VHigh.ON.Ar',0.80,22],
    // (D) Level 3
    [1,3,1,10,'Low','Low-Med.DC.Jr',0.80,17],[1,3,2,10,'Low','Low-Med.OF.In',0.20,16],
    [1,3,3,51,'Med','Low-Med.DC.Jr',0.30,17],[1,3,4,51,'Med','Low-Med.OF.In',0.35,16],[1,3,5,51,'Med','Low-Med.ON.In',0.35,12],
    [1,3,6,29,'High','High-VHigh.ON.Sr',0.80,21],[1,3,7,29,'High','High-VHigh.ON.Ar',0.20,22],
    [1,3,8,10,'VHigh','High-VHigh.ON.Sr',0.20,21],[1,3,9,10,'VHigh','High-VHigh.ON.Ar',0.80,22],
    // (B) Level 1
    [2,1,1,80,'Low','Low-Med.ON.In',0.40,11],[2,1,2,80,'Low','Low-Med.ON.Sr',0.10,12],[2,1,3,80,'Low','Low-Med.OF.In',0.50,14],
    [2,1,4,10,'Med','Low-Med.ON.In',0.30,11],[2,1,5,10,'Med','Low-Med.ON.Sr',0.30,12],[2,1,6,10,'Med','Low-Med.NR.In',0.40,13],
    [2,1,7,10,'High','High-VHigh.ON.Sr',0.60,16],[2,1,8,10,'High','High-VHigh.ON.Ar',0.40,17],
    [2,1,9,0,'VHigh','High-VHigh.ON.Sr',0.60,16],[2,1,10,0,'VHigh','High-VHigh.ON.Ar',0.40,17],
    // (B) Level 2
    [2,2,1,50,'Low','Low-Med.ON.In',0.40,11],[2,2,2,50,'Low','Low-Med.ON.Sr',0.10,12],[2,2,3,50,'Low','Low-Med.OF.In',0.50,14],
    [2,2,4,30,'Med','Low-Med.ON.In',0.30,11],[2,2,5,30,'Med','Low-Med.ON.Sr',0.30,12],[2,2,6,30,'Med','Low-Med.NR.In',0.40,13],
    [2,2,7,15,'High','High-VHigh.ON.Sr',0.60,16],[2,2,8,15,'High','High-VHigh.ON.Ar',0.40,17],
    [2,2,9,5,'VHigh','High-VHigh.ON.Sr',0.60,16],[2,2,10,5,'VHigh','High-VHigh.ON.Ar',0.40,17],
    // (B) Level 3
    [2,3,1,10,'Low','Low-Med.ON.In',0.40,11],[2,3,2,10,'Low','Low-Med.ON.Sr',0.10,12],[2,3,3,10,'Low','Low-Med.OF.In',0.50,14],
    [2,3,4,21,'Med','Low-Med.ON.In',0.30,11],[2,3,5,21,'Med','Low-Med.ON.Sr',0.30,12],[2,3,6,21,'Med','Low-Med.NR.In',0.40,13],
    [2,3,7,59,'High','High-VHigh.ON.Sr',0.60,16],[2,3,8,59,'High','High-VHigh.ON.Ar',0.40,17],
    [2,3,9,10,'VHigh','High-VHigh.ON.Sr',0.60,16],[2,3,10,10,'VHigh','High-VHigh.ON.Ar',0.40,17],
    // (M) Level 1
    [3,1,1,80,'Low','Low-Med.NR.Jr',0.50,13],[3,1,2,80,'Low','Low-Med.OF.Jr',0.50,16],
    [3,1,3,10,'Med','Low-Med.ON.In',0.40,11],[3,1,4,10,'Med','Low-Med.ON.Sr',0.20,12],[3,1,5,10,'Med','Low-Med.NR.In',0.30,14],[3,1,6,10,'Med','Low-Med.NR.Sr',0.10,15],
    [3,1,7,10,'High','High-VHigh.ON.Sr',0.70,17],[3,1,8,10,'High','High-VHigh.ON.Ar',0.30,18],
    [3,1,9,0,'VHigh','High-VHigh.ON.Sr',0.30,17],[3,1,10,0,'VHigh','High-VHigh.ON.Ar',0.70,18],
    // (M) Level 2
    [3,2,1,50,'Low','Low-Med.NR.Jr',0.50,13],[3,2,2,50,'Low','Low-Med.OF.Jr',0.50,16],
    [3,2,3,30,'Med','Low-Med.ON.In',0.40,11],[3,2,4,30,'Med','Low-Med.ON.Sr',0.20,12],[3,2,5,30,'Med','Low-Med.NR.In',0.30,14],[3,2,6,30,'Med','Low-Med.NR.Sr',0.10,15],
    [3,2,7,15,'High','High-VHigh.ON.Sr',0.70,17],[3,2,8,15,'High','High-VHigh.ON.Ar',0.30,18],
    [3,2,9,5,'VHigh','High-VHigh.ON.Sr',0.30,17],[3,2,10,5,'VHigh','High-VHigh.ON.Ar',0.70,18],
    // (M) Level 3
    [3,3,1,10,'Low','Low-Med.NR.Jr',0.50,13],[3,3,2,10,'Low','Low-Med.OF.Jr',0.50,16],
    [3,3,3,21,'Med','Low-Med.ON.In',0.40,11],[3,3,4,21,'Med','Low-Med.ON.Sr',0.20,12],[3,3,5,21,'Med','Low-Med.NR.In',0.30,14],[3,3,6,21,'Med','Low-Med.NR.Sr',0.10,15],
    [3,3,7,59,'High','High-VHigh.ON.Sr',0.70,17],[3,3,8,59,'High','High-VHigh.ON.Ar',0.30,18],
    [3,3,9,10,'VHigh','High-VHigh.ON.Sr',0.30,17],[3,3,10,10,'VHigh','High-VHigh.ON.Ar',0.70,18]
  ];
  for (const t of TEAM) {
    await pool.query(
      'INSERT INTO blended_team_composition (config_id,level_number,sort_order,multi,complexity,individual,weight,col_ref) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      t
    );
  }
  console.log('Blended team data seeded (3 teams × 3 levels).');
}

async function seedComplexityFactors(pool) {
  const { rows } = await pool.query('SELECT count(*) AS cnt FROM complexity_definitions WHERE version_id = 1');
  if (parseInt(rows[0].cnt) >= 10) return;

  console.log('Seeding complexity factors from Excel...');
  const DEFS = [
    { team:'DEV', g:'Report Abap', s:'ALV', factors:[
      ['Number of tables',null,'1 to 2','3 to 5','6 to 8','> 9'],
      ['Processing logic',null,'none or very simple','Moderate','Complex','Very Complex'],
      ['Structure',null,'Linear (Template)','Linear (Template)','Multi dimensional','Multi dimensional'],
      ['Layout',null,'ALV','ALV','ALV','ALV / TREE / Hierarchical'],
      ['Hotspot',null,'none','<= 2','<= 2','> 3'],
      ['Drill Down',null,'NO','NO','NO','YES'],
      ['Totals',null,'Simple','Simple','Complex','Complex']]},
    { team:'DEV', g:'Program', s:'Abap', factors:[
      ['Number of database tables/CDS','1 or 2','2 or 3','3 or 4','4 or more','5 or more'],
      ['Operations','READ','READ and Simple Update','Multiple Update Scenario or Creation','CRUD','CRUD'],
      ['Selection-screen','simple','simple','medium','medium-high','high'],
      ['Number of screens','1','1','2 or 3','3 or 4','cockpit like']]},
    { team:'DEV', g:'RESTFul ABAP', s:'Backend', factors:[
      ['Number of custom CDS views','2','2 or 3','4 or 5','> 2','> 2'],
      ['Managed or Unmanaged','Managed','Managed','Managed','Managed','UnManaged'],
      ['Is this transactional','No','No','No','Yes','Yes'],
      ['Attachments','No','No','No','No','Yes'],
      ['Number of Actions/Determinations','0','0','1 or 2','1 or 2','> 2'],
      ['Draft','No','No','No','Yes','Yes']]},
    { team:'DEV', g:'Interface Abap', s:'Inbound', factors:[
      ['Field Mapping',null,'1 to 30','31 to 60','61 to 90','> 90'],
      ['Data Manipulation',null,'Minor','Minor','Complex','Very complex'],
      ['Bus. Objects affected',null,'2','1','>1','>1'],
      ['IDOC',null,null,'Standard','Custom','Custom'],
      ['Inbound FM',null,'Standard','Standard +','Custom','Custom'],
      ['Flat File',null,null,'Simple','Header / Details','Header / Details'],
      ['RFC',null,'X','X','X','X'],
      ['Webservice',null,'X','X','X','X'],
      ['Error Handling',null,'Log','Log','ALE','ALE']]},
    { team:'DEV', g:'Interface Abap', s:'Outbound', factors:[
      ['Data Selection',null,'1 or 2 tables','2-5 tables','Multiple objects','Multiple objects'],
      ['Data Manipulation',null,'Minor','Minor','Complex','Very complex'],
      ['Bus. Objects affected',null,'1','1','>1','>1'],
      ['IDOC',null,null,'Standard','Custom','Custom'],
      ['Outbound FM',null,'Standard','Standard +','Custom','Custom'],
      ['Flat File',null,null,'Simple','Header / Details','Header / Details'],
      ['RFC',null,'X','X','X','X'],
      ['Webservice',null,'X','X','X','X'],
      ['Error Handling',null,'Log','Log','ALE','ALE']]},
    { team:'DEV', g:'Process Integration', s:'Mapping', factors:[
      ['Pre-packaged content','No adjustments','1 or 2 field adjustments','More than 2 fields adjustments',null,null],
      ['Number of mapping','0','2','1 to 2','>2','>2'],
      ['Complex Adapter','N','Y','Y','Y','Y'],
      ['Simple Adapter','Y','Y','Y','Y','Y'],
      ['Number of ICO','2','2','1 to 2','1 to 2','3 and more'],
      ['Mapping - Structural alignment','0','aligned','simple difference','complex difference','complex difference'],
      ['Mapping - Number of fields','0','1 to 20','20 to 40','40 and more','40 and more'],
      ['Mapping - Complexity of logic','none','1 to 1, no transformation','simple logic at field level','complex derivation','complex derivation'],
      ['Extra lookup','N','N','N','Y','Y']]},
    { team:'DEV', g:'CPI', s:'Mapping', factors:[
      ['Pre-packaged content','No adjustments','1 or 2 field adjustments','More than 2 fields adjustments',null,null],
      ['Number of mapping','0','1','1 to 2','>2','>2'],
      ['Complex Adapter','N','Y','Y','Y','Y'],
      ['Simple Adapter','Y','Y','Y','Y','Y'],
      ['Number of ICO','1','1','1 to 2','1 to 2','3 and more'],
      ['Mapping - Structural alignment','0','aligned','simple difference','complex difference','complex difference'],
      ['Mapping - Number of fields','0','1 to 20','20 to 40','40 and more','40 and more'],
      ['Mapping - Complexity of logic','none','1 to 1, no transformation','simple logic at field level','complex derivation','complex derivation'],
      ['Extra lookup','N','N','N','Y','Y']]},
    { team:'DEV', g:'Conversion', s:'Load', factors:[
      ['Type',null,'LSMW','Custom Program','Custom Program','Custom Program'],
      ['Number of Fields',null,'1 to 10','11 to 30','>30','>30'],
      ['Bus. Objects affected',null,'2','1','>1','>1'],
      ['Posting Steps',null,'2','1','>1','>1'],
      ['Data Manipulation',null,'Minor','Minor','Complex','Very complex'],
      ['BAPI available',null,'Yes','Yes','Yes','No'],
      ['Error Handling',null,'Log','Log','ALE','ALE']]},
    { team:'DEV', g:'Enhancement', s:'Modification', factors:[
      ['Type',null,'Formulas / Requirements / User-Exits','User-Exits / Dialog Programs','User-Exits / Dialog Programs','User-Exits / Dialog Programs'],
      ['Logic',null,'Simple','Simple to Moderate','Complex','Very Complex'],
      ['Number of Exits',null,'1','up to 2','up to 3','>4'],
      ['High Level Logical Steps',null,'<= 3','<= 5','<= 15','>15'],
      ['Number of Screens',null,'none','1 to 2','<=3','> 3'],
      ['Controls',null,'none','none','up to 1','>1'],
      ['Screen Technology',null,'N/A','ABAP Dynpro','ABAP Dynpro','ABAP WebDynpro'],
      ['Screen Logic',null,'N/A','Display only','Change','Change'],
      ['Post SAP Changes',null,'No','No','Yes 1 object type','Yes >1 object type'],
      ['Standard Use of User-Exit',null,'Yes','Yes','Yes','No']]},
    { team:'DEV', g:'Enhancement', s:'CDS View', factors:[
      ['Number of views','1','2','<=4','>5','>8'],
      ['Exposed as OData','No','Yes/No','Yes/No','Yes/No','Yes/No'],
      ['Any SEGW','No','Yes/No','Yes/No','Yes','Yes'],
      ['Behavior - number of actions','0','0','0-2','0-2','>2'],
      ['Hierarchy','No','No','No','Yes/No','Yes/No']]},
    { team:'DEV', g:'Form', s:'Standard', factors:[
      ['Pages',null,'Single','Multiple','Multiple','Multiple'],
      ['Page Layouts',null,'1','2','>2','>2'],
      ['Number of fields',null,'few','header / detail','Complex','Complex'],
      ['Dynamic changes',null,'No','No','Yes','Yes'],
      ['Logic complexity',null,'Low','Medium','High','Very High'],
      ['New form from scratch',null,null,'X','X','X'],
      ['Data Source','Fields available','Fields not available','Fields not available','Fields not available','Fields not available'],
      ['Needs CF&L',null,'X','X','X','X']]},
    { team:'DEV', g:'Fiori', s:'FE - Fiori Element', factors:[
      ['Fits FE Floorplan','Yes','Yes','Yes',null,null],
      ['Complexity increase expected','No','No','No',null,null],
      ['Front-end logic required','No','No','Yes, validations/format only',null,null],
      ['How many Behaviour actions','0-1','1-3','> 3',null,null],
      ['Changes data in how many CDS views','0 (Read only)','1','1',null,null]]},
    { team:'DEV', g:'Fiori', s:'FE - Freestyle', factors:[
      ['Fits Fiori Floorplans',null,null,null,'Yes','No'],
      ['Shared code / UI5 Library',null,null,null,'No','Yes'],
      ['How many Views/pages',null,null,null,'1 to 3','3 to 5'],
      ['Interaction with multiple back-ends',null,null,null,'Yes','Yes'],
      ['Requires custom controls',null,null,null,'No','Yes']]},
    { team:'DEV', g:'Fiori Extension', s:'Frontend', factors:[
      ['New fields added','1-3','3-5','5-10','> 10','> 10'],
      ['Front-end logic required','No','Validations/format only','READ from new back-end','READ from multiple back-ends','CHANGE data in back-ends'],
      ['Interaction with new back-ends','No','No','1','> 1','> 1'],
      ['Create new Views/pages','No','No','1','> 1','> 1']]},
    { team:'DEV', g:'CAP', s:'Frontend', factors:[
      ['Integration with Build Workzone','No','No','Yes','Yes','Yes'],
      ['Custom Controls','No','No','No','No','Yes'],
      ['Front-end logic required','No','Validations/format only','READ from back-end','READ from multiple back-ends','CHANGE data in back-ends'],
      ['Create new Views/pages','1','1','1','2 or 3','>3']]},
    { team:'DEV', g:'CAP', s:'Service', factors:[
      ['Integration with Build Workzone','No','No','Yes','Yes','Yes'],
      ['Number of Service definitions','1','1','1 or 2','3 or 4','> 4'],
      ['Interaction with API services','1','1','1','2','>2'],
      ['Integration with other BTP services','0','0','0','0','1 or 2'],
      ['Operations on DB','No','No','No','Med-CRUD','CRUD'],
      ['Integration with backend systems','1','1','1','1 or 2','> 2']]},
    { team:'DEV', g:'CAP', s:'DB', factors:[
      ['Number of procedures','0','0','1','1 to 3','> 3'],
      ['XS Advanced','No','No','No','No','Yes'],
      ['XS Jobs/JS','No','No','No','No','Yes'],
      ['Number of Tables/views','1','1','1 or 2','3 or 4','> 4'],
      ['Complexity of data model','Low','Low-Med','Med','Med-high','High-V.High']]},
    { team:'DEV', g:'Build', s:'Process Automation', factors:[
      ['Number of Approvers','1','1','1','2 or 3','>3'],
      ['Email Notification','No','Yes','Yes','Yes','Yes'],
      ['Creation Form','default','default','default','default','SAPUI5'],
      ['Business Rules','No','No','1','2 or 3','>3'],
      ['Approval Form','default','default','default','SAPUI5','SAPUI5']]},
    { team:'DEV', g:'Build', s:'RPA', factors:[
      ['Unattended','No','No','No','No','Yes'],
      ['Number of Plug-ins','1','1','2','2 or 3','>3'],
      ['Number of Subflows','1','1','2','2 or 3','>3'],
      ['Email Notification (Alert)','1','1','2','2 or 3','>3'],
      ['API Calls','1','1','2','2 or 3','>3'],
      ['Business Rules','1','1','2','2 or 3','>3'],
      ['Error Handling & Reprocessing','No','No','Yes','Yes','Yes']]},
    { team:'DEV', g:'Build', s:'BuildApp FE', factors:[
      ['Number of Pages','1 or 2','2','3','4','>5'],
      ['Integration with backend systems','0 or 1','1','1','1 or 2','1 or 2'],
      ['Visual Cloud Function','Yes','Yes/No','No','No','No'],
      ['Offline or MDM','No','No','No','No','Yes'],
      ['Mobile device controls','No','Yes','Yes','Yes','Yes'],
      ['Branding (theme)','No','No','No','Yes','Yes'],
      ['App or Site','App','App','App','Site','Site'],
      ['Mobile/Desktop/Responsive','Mobile','Mobile','Desktop or Mobile','Desktop','Hybrid']]},
    { team:'DEV', g:'PI Migration', s:'Mapping', factors:[
      ['JAVA mapping or XSL','Ready to Migrate','Adjustment Required','Evaluation required',null,null],
      ['OM Steps Count',null,'2','3 or more',null,null],
      ['Lookup - Count',null,'RFC,SOAP','JDBC',null,null],
      ['BPM or BRM',null,null,null,'No Migration - redesign',null],
      ['B2B interfaces',null,null,null,'No Migration - redesign',null],
      ['Parameterized','1 mapping object','2 mapping object','3 or more',null,null],
      ['IDOC sender',null,'Need to add Generic Router Flow',null,null,null],
      ['Email Notification (exceptions)',null,'Yes',null,null,null],
      ['File Content Conversion','Yes',null,null,null,null],
      ['Assessment Category','Ready to migrate S,M','Ready to migrate L / Adj Required S,M / Eval required S','Adj Required L / Eval required M','Eval required L or XL',null]]},
    { team:'DEV', g:'PI Migration', s:'Extract-Load', factors:[
      ['Custom module',null,null,null,null,null],
      ['AdapterTypes-FILE, Custom',null,null,null,null,null],
      ['Complex Adapter-REST with OAuth',null,null,null,null,null],
      ['XI(PROXY)',null,'ABAP effort - MDR conversion',null,null,null],
      ['QOS- EOIO or Queues',null,null,null,'Need Event Mesh + Redesign',null]]},
    { team:'MIGRATION', g:'Migration', s:'Extraction', factors:[
      ['Number of source systems','1','2 to 3','3 to 4','4 to 6','6+'],
      ['Extraction method','Standard views','Direct tables','Multiple tables','Multiple tables','Multiple tables'],
      ['Setup','Already available','Already available','Direct access','No Direct access','No Direct access'],
      ['Data volume','<1k','<10k','<100k','<1M','>1M']]},
    { team:'MIGRATION', g:'Migration', s:'Cleansing', factors:[
      ['Overall data quality','No cleansing needed','Minimal cleansing','Moderate Cleansing','Major issues','Critical'],
      ['Cleansing rules','None','Obvious','Mapping-based','Complex','Undefined'],
      ['Deduplication','None','Key-based','Rule-based','Fuzzy','Complex clustering'],
      ['Normalization','None','Minimal','Moderate','Complex','Re-engineering'],
      ['Enrichment','None','Static lookup','SAP reference','External','External + manual'],
      ['Business involvement','None','Light','Workshops','Repeated','Heavy']]},
    { team:'MIGRATION', g:'Migration', s:'Development', factors:[
      ['Transformation logic','None','Simple','Moderate','Complex','Algorithmic / Very Complex'],
      ['Number of target/staging tables','1','1 to 2','2 to 4','4 to 6','6+'],
      ['Dependencies','None','Weak','Moderate','Strong','Circular'],
      ['Validation type','Minimal','Minimal','Minimal','Industry Specific','Regulatory'],
      ['Reusability','One-off','Minor','Shared','Multi-wave','Enterprise-wide']]},
    { team:'MIGRATION', g:'Migration', s:'Mock Load QA', factors:[
      ['Development complexity','Very Low','Low','Medium','High','Very High']]},
    { team:'MIGRATION', g:'Migration', s:'Cutover', factors:[
      ['Development complexity','Very Low','Low','Medium','High','Very High'],
      ['Load type','One-time','One-time','Initial + delta','Multiple delta','Continuous'],
      ['Delta window','Flexible','>24h','8-24h','<8h','Near-zero'],
      ['Downtime','Unlimited','Planned','Limited','Minimal','None']]},
    { team:'BI', g:'BI FE', s:'Story', factors:[
      ['Number of pages','1','2','2-4','4-6','>6'],
      ['Formatting','simple','simple-medium','medium','medium','complex'],
      ['Calculated measures','1-2','3-5','5-10','>10','>10'],
      ['Linked models','no','no','Yes/no','Yes/no','Yes/no'],
      ['Thresholds','no','1-2','2-4','>4','>4'],
      ['Planning','no','Simple','simple-medium','medium','complex']]},
    { team:'BI', g:'BI FE', s:'Analysis', factors:[
      ['Formatting','simple','simple-medium','medium','medium','complex'],
      ['Number of tabs','1','1','1-2','1-2','>2'],
      ['VBA functions','no','no','1','2','3']]},
    { team:'BI', g:'BI Model', s:'Standard', factors:[
      ['Model type','Live','Import','Import','Import','Import'],
      ['Business Content available','Yes/No','Yes','Yes/No','No','No'],
      ['Number of transformations','0','< 5','5-10','> 10','> 10'],
      ['Number of sources','1','1','2','> 2','> 2'],
      ['Link with public dimensions','no','1','2-3','>3','>3'],
      ['Value driver tree','no','no','no','yes/no','yes/no'],
      ['Security','no','low','low-medium','medium','high']]},
    { team:'BI', g:'BI Model', s:'Planning', factors:[
      ['Model type','Import','Import','Import','Import, Planning','Planning'],
      ['Business Content available','Yes','Yes/No','Yes/No','No','No'],
      ['Number of transformations','0','< 5','5-10','> 10','> 10'],
      ['Number of sources','1','1','2','> 2','> 2'],
      ['Number of Data actions','1','2','2-4','>4','>4'],
      ['Complexity of data actions','Standard','copy / versioning','copy / versioning','Advanced Formula / allocation','Advanced Formula / allocation'],
      ['Link with public dimensions','1','2-3','>3','>3','>3'],
      ['Security','no','low','low-medium','medium','high'],
      ['Process Workflow','no','no','Yes/no','Yes/no','Yes/no'],
      ['Validation rules / data locking','no','no','Yes/no','Yes/no','Yes/no'],
      ['Planning complexity','Low','low','medium','high','very high']]},
    { team:'BI', g:'BI BE', s:'CDS View', factors:[
      ['CDS','Standard','standard-custom','standard-custom','standard-custom','standard-custom'],
      ['Enhancement of standard','Simple association','Simple association','Medium complexity custom','Multiple standard views','Full custom, lots of logic'],
      ['Views to enhance','1-2','2-4','4-6','6-8','>8'],
      ['Full Custom Number of views','1','2','<=4','>5','>8'],
      ['Exposed as OData','Yes/No','Yes/No','Yes/No','Yes/No','Yes/No'],
      ['Translation','No','Yes/No','Yes/No','Yes/No','Yes/No'],
      ['Hierarchy','No','No','No','Yes/No','Yes/No'],
      ['Cross module join complexity','simple','simple-medium','medium','medium','complex']]}
  ];

  for (const d of DEFS) {
    const existing = await pool.query(
      'SELECT id FROM complexity_definitions WHERE version_id=1 AND classification_group=$1 AND subgroup=$2',
      [d.g, d.s]
    );
    let defId;
    if (existing.rows.length > 0) {
      defId = existing.rows[0].id;
      const fc = await pool.query('SELECT count(*) AS cnt FROM complexity_factors WHERE definition_id=$1', [defId]);
      if (parseInt(fc.rows[0].cnt) > 0) continue;
    } else {
      const ins = await pool.query(
        'INSERT INTO complexity_definitions (version_id,team,classification_group,subgroup) VALUES (1,$1,$2,$3) RETURNING id',
        [d.team, d.g, d.s]
      );
      defId = ins.rows[0].id;
    }
    for (let i = 0; i < d.factors.length; i++) {
      const f = d.factors[i];
      await pool.query(
        `INSERT INTO complexity_factors (definition_id,factor_name,value_very_low,value_low,value_medium,value_high,value_very_high,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [defId, f[0], f[1]||null, f[2]||null, f[3]||null, f[4]||null, f[5]||null, i+1]
      );
    }
  }
  console.log('Complexity factors seeded (' + DEFS.length + ' classifications).');
}

module.exports = { getPool, initDb };
