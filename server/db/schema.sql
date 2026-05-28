-- ============================================================
-- RICEFW Estimator - Database Schema (PostgreSQL)
-- ============================================================

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id              SERIAL PRIMARY KEY,
    project_number  TEXT    NOT NULL,
    description     TEXT    NOT NULL,
    currency        TEXT    NOT NULL DEFAULT 'USD',
    delivery_level  INTEGER NOT NULL DEFAULT 1,
    start_date      TEXT,
    end_date        TEXT,
    config_version_id INTEGER,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_number ON projects(project_number);

-- Config Versions (time-bound admin configuration sets)
CREATE TABLE IF NOT EXISTS config_versions (
    id          SERIAL PRIMARY KEY,
    name        TEXT    NOT NULL,
    description TEXT,
    valid_from  TEXT,
    valid_to    TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sheet Types (RICEF, BI, MIGRATION, etc.)
CREATE TABLE IF NOT EXISTS sheet_types (
    id          SERIAL PRIMARY KEY,
    code        TEXT    NOT NULL UNIQUE,
    label       TEXT    NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1
);

-- RICEF Types (the 13 configurable object types)
CREATE TABLE IF NOT EXISTS ricef_types (
    id              SERIAL PRIMARY KEY,
    version_id      INTEGER NOT NULL DEFAULT 1,
    code            TEXT    NOT NULL,
    label           TEXT    NOT NULL,
    full_label      TEXT    NOT NULL,
    seq_from        INTEGER NOT NULL,
    seq_to          INTEGER NOT NULL,
    sheet_type_code TEXT    NOT NULL DEFAULT 'RICEF',
    icon            TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (sheet_type_code) REFERENCES sheet_types(code),
    FOREIGN KEY (version_id) REFERENCES config_versions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ricef_types_ver ON ricef_types(version_id, code);

-- Estimation line items
CREATE TABLE IF NOT EXISTS items (
    id                  SERIAL PRIMARY KEY,
    project_id          INTEGER NOT NULL,
    ricef_type_id       INTEGER NOT NULL,
    backlog_number      TEXT,
    architecture_ref    TEXT,
    tsa_group           INTEGER,
    tsa_process         TEXT,
    special_notes       TEXT,
    predecessor         TEXT,
    seq_number          INTEGER NOT NULL,
    module              TEXT,
    ricef_number        TEXT    NOT NULL,
    description         TEXT,
    design_notes        TEXT,
    status              TEXT    NOT NULL DEFAULT 'New',
    func_effort_adj     DOUBLE PRECISION NOT NULL DEFAULT 1,
    func_team           TEXT    DEFAULT 'SYNTAX',
    func_role           TEXT,
    tech_effort_adj     DOUBLE PRECISION NOT NULL DEFAULT 1,
    tech_team           TEXT    DEFAULT 'SYNTAX',
    tech_role           TEXT,
    object_type         TEXT,
    classification      TEXT,
    complexity          TEXT    NOT NULL DEFAULT '0-TBD',
    blended_multiplier  DOUBLE PRECISION DEFAULT 0,
    sub_items_func      DOUBLE PRECISION DEFAULT 0,
    sub_items_tech      DOUBLE PRECISION DEFAULT 0,
    build_func          DOUBLE PRECISION DEFAULT 0,
    build_tech          DOUBLE PRECISION DEFAULT 0,
    sit_func            DOUBLE PRECISION DEFAULT 0,
    sit_tech            DOUBLE PRECISION DEFAULT 0,
    total_func_hours    DOUBLE PRECISION DEFAULT 0,
    total_tech_hours    DOUBLE PRECISION DEFAULT 0,
    grand_total_hours   DOUBLE PRECISION DEFAULT 0,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (ricef_type_id) REFERENCES ricef_types(id)
);
CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(ricef_type_id);
CREATE INDEX IF NOT EXISTS idx_items_project_seq ON items(project_id, ricef_type_id, seq_number);

-- Estimation Grid
CREATE TABLE IF NOT EXISTS estimation_grid (
    id              SERIAL PRIMARY KEY,
    version_id      INTEGER NOT NULL DEFAULT 1,
    frice           TEXT    NOT NULL,
    classification  TEXT    NOT NULL,
    complexity      TEXT    NOT NULL,
    baseline        DOUBLE PRECISION NOT NULL DEFAULT 0,
    fs_bus_req      DOUBLE PRECISION NOT NULL DEFAULT 0,
    fs_f_analysis   DOUBLE PRECISION NOT NULL DEFAULT 0,
    fs_f_spec       DOUBLE PRECISION NOT NULL DEFAULT 0,
    dev_t_analysis  DOUBLE PRECISION NOT NULL DEFAULT 0,
    dev_t_spec      DOUBLE PRECISION NOT NULL DEFAULT 0,
    dev_coding      DOUBLE PRECISION NOT NULL DEFAULT 0,
    dev_tt_cases    DOUBLE PRECISION NOT NULL DEFAULT 0,
    dev_ut          DOUBLE PRECISION NOT NULL DEFAULT 0,
    dev_qa          DOUBLE PRECISION NOT NULL DEFAULT 0,
    fut_f_tcases    DOUBLE PRECISION NOT NULL DEFAULT 0,
    fut_test_data   DOUBLE PRECISION NOT NULL DEFAULT 0,
    fut_fut         DOUBLE PRECISION NOT NULL DEFAULT 0,
    brk_fix         DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_func      DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_tech      DOUBLE PRECISION NOT NULL DEFAULT 0,
    grand_total     DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_eg_lookup ON estimation_grid(version_id, frice, classification, complexity);

-- Estimation Factors (phase-level calculation factors)
CREATE TABLE IF NOT EXISTS estimation_factors (
    id          SERIAL PRIMARY KEY,
    factor_key  TEXT    NOT NULL UNIQUE,
    factor_name TEXT    NOT NULL,
    calc_factor DOUBLE PRECISION NOT NULL
);

-- Blended Rate Configurations (per team: D, B, M)
CREATE TABLE IF NOT EXISTS blended_rate_configs (
    id              SERIAL PRIMARY KEY,
    version_id      INTEGER NOT NULL DEFAULT 1,
    team_prefix     TEXT    NOT NULL,
    team_label      TEXT    NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (version_id) REFERENCES config_versions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brc_ver ON blended_rate_configs(version_id, team_prefix);

-- Effort multiplier by complexity
CREATE TABLE IF NOT EXISTS blended_effort_by_complexity (
    id              SERIAL PRIMARY KEY,
    config_id       INTEGER NOT NULL,
    complexity      TEXT    NOT NULL,
    multiplier      DOUBLE PRECISION NOT NULL,
    FOREIGN KEY (config_id) REFERENCES blended_rate_configs(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bebc ON blended_effort_by_complexity(config_id, complexity);

-- Delivery levels (3 per config)
CREATE TABLE IF NOT EXISTS blended_delivery_levels (
    id              SERIAL PRIMARY KEY,
    config_id       INTEGER NOT NULL,
    level_number    INTEGER NOT NULL,
    level_label     TEXT    NOT NULL,
    FOREIGN KEY (config_id) REFERENCES blended_rate_configs(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bdl ON blended_delivery_levels(config_id, level_number);

-- Rates per delivery level per currency
CREATE TABLE IF NOT EXISTS blended_rates (
    id                  SERIAL PRIMARY KEY,
    level_id            INTEGER NOT NULL,
    currency            TEXT    NOT NULL,
    billable_rate       DOUBLE PRECISION NOT NULL,
    effort_multiplier   DOUBLE PRECISION NOT NULL,
    blended_cost        DOUBLE PRECISION NOT NULL,
    margin_pct          DOUBLE PRECISION NOT NULL,
    FOREIGN KEY (level_id) REFERENCES blended_delivery_levels(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_br ON blended_rates(level_id, currency);

-- Complexity Definitions
CREATE TABLE IF NOT EXISTS complexity_definitions (
    id                  SERIAL PRIMARY KEY,
    version_id          INTEGER NOT NULL DEFAULT 1,
    team                TEXT    NOT NULL,
    classification_group TEXT   NOT NULL,
    subgroup            TEXT    NOT NULL,
    func_very_low       DOUBLE PRECISION DEFAULT 0,
    func_low            DOUBLE PRECISION DEFAULT 0,
    func_medium         DOUBLE PRECISION DEFAULT 0,
    func_high           DOUBLE PRECISION DEFAULT 0,
    func_very_high      DOUBLE PRECISION DEFAULT 0,
    tech_very_low       DOUBLE PRECISION DEFAULT 0,
    tech_low            DOUBLE PRECISION DEFAULT 0,
    tech_medium         DOUBLE PRECISION DEFAULT 0,
    tech_high           DOUBLE PRECISION DEFAULT 0,
    tech_very_high      DOUBLE PRECISION DEFAULT 0
);

-- Complexity Factors (descriptive factor rows)
CREATE TABLE IF NOT EXISTS complexity_factors (
    id              SERIAL PRIMARY KEY,
    definition_id   INTEGER NOT NULL,
    factor_name     TEXT    NOT NULL,
    value_very_low  TEXT,
    value_low       TEXT,
    value_medium    TEXT,
    value_high      TEXT,
    value_very_high TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (definition_id) REFERENCES complexity_definitions(id) ON DELETE CASCADE
);

-- Dropdown Categories
CREATE TABLE IF NOT EXISTS dropdown_categories (
    id          SERIAL PRIMARY KEY,
    version_id  INTEGER NOT NULL DEFAULT 1,
    code        TEXT    NOT NULL,
    label       TEXT    NOT NULL,
    is_system   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (version_id) REFERENCES config_versions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dc_ver ON dropdown_categories(version_id, code);

-- Dropdown Values
CREATE TABLE IF NOT EXISTS dropdown_values (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL,
    value           TEXT    NOT NULL,
    display_label   TEXT,
    is_separator    INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES dropdown_categories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dv_cat ON dropdown_values(category_id);

-- Sheet Column Config
CREATE TABLE IF NOT EXISTS sheet_column_config (
    id              SERIAL PRIMARY KEY,
    version_id      INTEGER NOT NULL DEFAULT 1,
    sheet_type_code TEXT    NOT NULL,
    column_key      TEXT    NOT NULL,
    column_label    TEXT    NOT NULL,
    data_type       TEXT    NOT NULL DEFAULT 'text',
    dropdown_code   TEXT,
    is_visible      INTEGER NOT NULL DEFAULT 1,
    is_editable     INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    width           TEXT    DEFAULT '10rem',
    FOREIGN KEY (sheet_type_code) REFERENCES sheet_types(code)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scc ON sheet_column_config(version_id, sheet_type_code, column_key);

-- Project SIT/Contingency Factors
CREATE TABLE IF NOT EXISTS project_factors (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL UNIQUE,
    cont_func_pct   DOUBLE PRECISION NOT NULL DEFAULT 0,
    cont_tech_pct   DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    sit_func_pct    DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    sit_tech_pct    DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Project phase weeks
CREATE TABLE IF NOT EXISTS project_phases (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL,
    prep        INTEGER NOT NULL DEFAULT 0,
    fts         INTEGER NOT NULL DEFAULT 0,
    design      INTEGER NOT NULL DEFAULT 0,
    build       INTEGER NOT NULL DEFAULT 0,
    sit_uat     INTEGER NOT NULL DEFAULT 0,
    dep         INTEGER NOT NULL DEFAULT 0,
    hyp         INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Functional phase distribution %
CREATE TABLE IF NOT EXISTS project_func_phase_pct (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL,
    prep        DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    fts         DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    design      DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    build       DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    sit_uat     DOUBLE PRECISION NOT NULL DEFAULT 0.24,
    dep         DOUBLE PRECISION NOT NULL DEFAULT 0.06,
    hyp         DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    architect_pct DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    arch_prep     DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    arch_fts      DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    arch_design   DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    arch_build    DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    arch_sit_uat  DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    arch_dep      DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    arch_hyp      DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- PGO % per phase
CREATE TABLE IF NOT EXISTS project_pgo (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL,
    prep        DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    fts         DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    design      DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    build       DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    sit_uat     DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    dep         DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    hyp         DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    lead_split  DOUBLE PRECISION NOT NULL DEFAULT 0.23,
    consultant_split DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Contingency % per phase
CREATE TABLE IF NOT EXISTS project_contingency (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL,
    prep        DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    fts         DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    design      DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    build       DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    sit_uat     DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    dep         DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    hyp         DOUBLE PRECISION NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Fixed role hours per phase per team (Architect, Tech Lead)
CREATE TABLE IF NOT EXISTS project_fixed_roles (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL,
    team        TEXT NOT NULL,
    role_name   TEXT NOT NULL,
    prep        DOUBLE PRECISION NOT NULL DEFAULT 0,
    fts         DOUBLE PRECISION NOT NULL DEFAULT 0,
    design      DOUBLE PRECISION NOT NULL DEFAULT 0,
    build       DOUBLE PRECISION NOT NULL DEFAULT 0,
    sit_uat     DOUBLE PRECISION NOT NULL DEFAULT 0,
    dep         DOUBLE PRECISION NOT NULL DEFAULT 0,
    hyp         DOUBLE PRECISION NOT NULL DEFAULT 0,
    grid_type   TEXT NOT NULL DEFAULT 'ORANGE',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Functional scope items (from FUNCTIONAL sheet scope item grid)
CREATE TABLE IF NOT EXISTS project_scope_items (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL,
    func_role   TEXT NOT NULL,
    lob         TEXT NOT NULL,
    low_count   INTEGER NOT NULL DEFAULT 0,
    medium_count INTEGER NOT NULL DEFAULT 0,
    high_count  INTEGER NOT NULL DEFAULT 0,
    very_high_hours DOUBLE PRECISION NOT NULL DEFAULT 0,
    localization_hours DOUBLE PRECISION NOT NULL DEFAULT 0,
    kdd_count   INTEGER NOT NULL DEFAULT 0,
    ip_count    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Scope item effort config (hours per complexity level)
CREATE TABLE IF NOT EXISTS project_scope_config (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL,
    low_hours   DOUBLE PRECISION NOT NULL DEFAULT 24,
    medium_hours DOUBLE PRECISION NOT NULL DEFAULT 48,
    high_hours  DOUBLE PRECISION NOT NULL DEFAULT 72,
    kdd_hours   DOUBLE PRECISION NOT NULL DEFAULT 40,
    ip_hours    DOUBLE PRECISION NOT NULL DEFAULT -40,
    complexity_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Per-sheet FUNC phase distribution %
CREATE TABLE IF NOT EXISTS project_sheet_func_pct (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL,
    sheet_type_code TEXT NOT NULL,
    prep            DOUBLE PRECISION NOT NULL DEFAULT 0,
    fts             DOUBLE PRECISION NOT NULL DEFAULT 0,
    design          DOUBLE PRECISION NOT NULL DEFAULT 0,
    build           DOUBLE PRECISION NOT NULL DEFAULT 0,
    sit_uat         DOUBLE PRECISION NOT NULL DEFAULT 0,
    dep             DOUBLE PRECISION NOT NULL DEFAULT 0,
    hyp             DOUBLE PRECISION NOT NULL DEFAULT 0,
    grid_type       TEXT NOT NULL DEFAULT 'ORANGE',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_psfp ON project_sheet_func_pct(project_id, sheet_type_code, grid_type);

-- Project Staffing Profiles
CREATE TABLE IF NOT EXISTS project_staffing_profiles (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL,
    team            TEXT NOT NULL,
    developer_role  TEXT NOT NULL,
    resource_type   TEXT DEFAULT 'developer',
    split_pct       DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    description     TEXT,
    work_item       TEXT,
    resource_org    TEXT,
    activity_type   TEXT,
    project_role    TEXT,
    num_resources   INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Project Snapshots (point-in-time captures for comparison)
CREATE TABLE IF NOT EXISTS project_snapshots (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL,
    phase           TEXT    NOT NULL,
    label           TEXT,
    total_items     INTEGER NOT NULL DEFAULT 0,
    total_hours     DOUBLE PRECISION NOT NULL DEFAULT 0,
    snapshot_json   TEXT    NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_snapshots_project ON project_snapshots(project_id);
