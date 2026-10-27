-- KonTraCk PLDS / PostgreSQL 17 / initial schema
-- Apply once to an empty database, as its dedicated migration owner.
-- psql -X -v ON_ERROR_STOP=1 -f 001_schema.sql "$DATABASE_URL"
BEGIN;
CREATE SCHEMA ktc;
REVOKE ALL ON SCHEMA ktc FROM PUBLIC;

CREATE TYPE ktc.project_role AS ENUM ('administrator','inspector','contractor','reviewer');
CREATE TYPE ktc.punch_status AS ENUM ('open','in_progress','ready_for_review','closed');
CREATE TYPE ktc.markup_kind AS ENUM ('pin','rectangle','line','arrow','freehand','text');
CREATE TYPE ktc.export_status AS ENUM ('queued','running','succeeded','failed');

CREATE TABLE ktc.schema_migration (
  version integer PRIMARY KEY,
  description varchar(200) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ktc.app_user (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_issuer varchar(255) NOT NULL CHECK (btrim(auth_issuer) <> ''),
  auth_subject varchar(255) NOT NULL CHECK (btrim(auth_subject) <> ''),
  display_name varchar(120) NOT NULL CHECK (btrim(display_name) <> ''),
  email varchar(254) CHECK (email IS NULL OR (email = btrim(email) AND email LIKE '%_@_%._%')),
  is_active boolean NOT NULL DEFAULT true,
  can_create_projects boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_issuer, auth_subject)
);
CREATE UNIQUE INDEX app_user_email_ci ON ktc.app_user (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE ktc.project (
  project_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL CHECK (btrim(name) <> ''),
  description text CHECK (description IS NULL OR length(description) <= 10000),
  created_by uuid NOT NULL REFERENCES ktc.app_user(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE ktc.project_user (
  project_user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ktc.project(project_id),
  user_id uuid NOT NULL REFERENCES ktc.app_user(user_id),
  role ktc.project_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX project_user_by_user ON ktc.project_user(user_id, project_id) WHERE is_active;

CREATE TABLE ktc.drawing (
  drawing_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ktc.project(project_id),
  filename varchar(255) NOT NULL CHECK (btrim(filename) <> ''),
  storage_ref varchar(1024) NOT NULL UNIQUE,
  content_type varchar(100) NOT NULL DEFAULT 'application/pdf' CHECK (content_type = 'application/pdf'),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  page_count integer NOT NULL CHECK (page_count > 0),
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, drawing_id),
  FOREIGN KEY (project_id, uploaded_by) REFERENCES ktc.project_user(project_id,user_id),
  CHECK (storage_ref = 'projects/' || project_id::text || '/drawings/' || drawing_id::text || '/source.pdf')
);

CREATE TABLE ktc.drawing_page (
  project_id uuid NOT NULL,
  drawing_id uuid NOT NULL,
  page_number integer NOT NULL CHECK (page_number > 0),
  width_points numeric(12,3) NOT NULL CHECK (width_points > 0 AND width_points <> 'NaN'::numeric),
  height_points numeric(12,3) NOT NULL CHECK (height_points > 0 AND height_points <> 'NaN'::numeric),
  rotation smallint NOT NULL DEFAULT 0 CHECK (rotation IN (0,90,180,270)),
  PRIMARY KEY (project_id, drawing_id, page_number),
  FOREIGN KEY (project_id, drawing_id) REFERENCES ktc.drawing(project_id,drawing_id)
);

CREATE TABLE ktc.punch_item (
  punch_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ktc.project(project_id),
  drawing_id uuid NOT NULL,
  page_number integer NOT NULL,
  x_ratio numeric(9,8) NOT NULL CHECK (x_ratio BETWEEN 0 AND 1),
  y_ratio numeric(9,8) NOT NULL CHECK (y_ratio BETWEEN 0 AND 1),
  title varchar(200) NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL CHECK (btrim(description) <> '' AND length(description) <= 10000),
  status ktc.punch_status NOT NULL DEFAULT 'open',
  assignee_user_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (project_id, punch_item_id),
  UNIQUE (project_id, drawing_id, page_number, punch_item_id),
  FOREIGN KEY (project_id, drawing_id, page_number) REFERENCES ktc.drawing_page(project_id,drawing_id,page_number),
  FOREIGN KEY (project_id, assignee_user_id) REFERENCES ktc.project_user(project_id,user_id),
  FOREIGN KEY (project_id, created_by) REFERENCES ktc.project_user(project_id,user_id)
);
CREATE INDEX punch_item_status_filter ON ktc.punch_item(project_id,status,created_at DESC,punch_item_id);
CREATE INDEX punch_item_assignee_filter ON ktc.punch_item(project_id,assignee_user_id,status);
CREATE INDEX punch_item_on_page ON ktc.punch_item(project_id,drawing_id,page_number);
CREATE INDEX punch_item_text_search ON ktc.punch_item USING gin(to_tsvector('english',title || ' ' || description));

CREATE TABLE ktc.comment (
  comment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  punch_item_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  body text NOT NULL CHECK (btrim(body) <> '' AND length(body) <= 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id,punch_item_id) REFERENCES ktc.punch_item(project_id,punch_item_id),
  FOREIGN KEY (project_id,author_user_id) REFERENCES ktc.project_user(project_id,user_id)
);
CREATE INDEX comment_on_item ON ktc.comment(project_id,punch_item_id,created_at,comment_id);

CREATE TABLE ktc.photo (
  photo_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  punch_item_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  filename varchar(255) NOT NULL CHECK (btrim(filename) <> ''),
  storage_ref varchar(1024) NOT NULL UNIQUE,
  content_type varchar(100) NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  caption varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id,punch_item_id) REFERENCES ktc.punch_item(project_id,punch_item_id),
  FOREIGN KEY (project_id,uploaded_by) REFERENCES ktc.project_user(project_id,user_id),
  CHECK (storage_ref = 'projects/' || project_id::text || '/photos/' || photo_id::text || '/original')
);
CREATE INDEX photo_on_item ON ktc.photo(project_id,punch_item_id);

-- Versioned, drawing-relative JSON. CHECK rejects NULL/missing/wrong-type coordinates.
CREATE FUNCTION ktc.valid_geometry(kind ktc.markup_kind, geometry jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, ktc AS $$
DECLARE point jsonb; n numeric;
BEGIN
  IF jsonb_typeof(geometry) IS DISTINCT FROM 'object'
     OR geometry->'schema_version' IS DISTINCT FROM '1'::jsonb
     OR jsonb_typeof(geometry->'points') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF (kind IN ('pin','text') AND jsonb_array_length(geometry->'points') <> 1)
     OR (kind IN ('rectangle','line','arrow') AND jsonb_array_length(geometry->'points') <> 2)
     OR (kind = 'freehand' AND jsonb_array_length(geometry->'points') NOT BETWEEN 2 AND 2000)
     THEN RETURN false; END IF;
  FOR point IN SELECT value FROM jsonb_array_elements(geometry->'points') LOOP
    IF jsonb_typeof(point) IS DISTINCT FROM 'object'
       OR jsonb_typeof(point->'x') IS DISTINCT FROM 'number'
       OR jsonb_typeof(point->'y') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    IF (point->>'x')::numeric NOT BETWEEN 0 AND 1 OR (point->>'y')::numeric NOT BETWEEN 0 AND 1 THEN RETURN false; END IF;
  END LOOP;
  IF kind = 'text' AND (jsonb_typeof(geometry->'text') IS DISTINCT FROM 'string'
     OR btrim(geometry->>'text') = '' OR length(geometry->>'text') > 2000) THEN RETURN false; END IF;
  RETURN true;
END $$;

CREATE TABLE ktc.markup (
  markup_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  drawing_id uuid NOT NULL,
  page_number integer NOT NULL,
  punch_item_id uuid,
  markup_type ktc.markup_kind NOT NULL,
  geometry_json jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id,drawing_id,page_number) REFERENCES ktc.drawing_page(project_id,drawing_id,page_number),
  FOREIGN KEY (project_id,drawing_id,page_number,punch_item_id) REFERENCES ktc.punch_item(project_id,drawing_id,page_number,punch_item_id),
  FOREIGN KEY (project_id,created_by) REFERENCES ktc.project_user(project_id,user_id),
  CHECK (octet_length(geometry_json::text) <= 262144 AND ktc.valid_geometry(markup_type,geometry_json))
);
CREATE INDEX markup_on_page ON ktc.markup(project_id,drawing_id,page_number);
CREATE INDEX markup_on_item ON ktc.markup(project_id,punch_item_id) WHERE punch_item_id IS NOT NULL;

CREATE TABLE ktc.export_job (
  export_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ktc.project(project_id),
  requested_by uuid NOT NULL,
  format varchar(20) NOT NULL DEFAULT 'zip_v1' CHECK (format = 'zip_v1'),
  status ktc.export_status NOT NULL DEFAULT 'queued',
  storage_ref varchar(1024) UNIQUE,
  size_bytes bigint CHECK (size_bytes > 0),
  sha256 char(64) CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  error_message varchar(2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  FOREIGN KEY (project_id,requested_by) REFERENCES ktc.project_user(project_id,user_id),
  CHECK (storage_ref IS NULL OR storage_ref = 'projects/' || project_id::text || '/exports/' || export_id::text || '/package.zip'),
  CHECK (
    (status = 'queued' AND started_at IS NULL AND completed_at IS NULL AND storage_ref IS NULL AND size_bytes IS NULL AND sha256 IS NULL AND error_message IS NULL AND expires_at IS NULL) OR
    (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL AND storage_ref IS NULL AND size_bytes IS NULL AND sha256 IS NULL AND error_message IS NULL AND expires_at IS NULL) OR
    (status = 'succeeded' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND storage_ref IS NOT NULL AND size_bytes IS NOT NULL AND sha256 IS NOT NULL AND error_message IS NULL AND expires_at IS NOT NULL) OR
    (status = 'failed' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND storage_ref IS NULL AND size_bytes IS NULL AND sha256 IS NULL AND btrim(error_message) <> '' AND error_message IS NOT NULL AND expires_at IS NULL)
  ),
  CHECK (started_at >= created_at AND completed_at >= started_at AND expires_at > completed_at)
);
CREATE INDEX export_queue ON ktc.export_job(created_at,export_id) WHERE status = 'queued';
CREATE INDEX export_by_project ON ktc.export_job(project_id,created_at DESC);

CREATE TABLE ktc.punch_item_event (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid NOT NULL,
  punch_item_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  action varchar(10) NOT NULL CHECK (action IN ('created','updated')),
  old_status ktc.punch_status,
  new_status ktc.punch_status NOT NULL,
  old_assignee uuid,
  new_assignee uuid,
  item_version integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id,punch_item_id) REFERENCES ktc.punch_item(project_id,punch_item_id),
  FOREIGN KEY (project_id,actor_user_id) REFERENCES ktc.project_user(project_id,user_id),
  FOREIGN KEY (project_id,old_assignee) REFERENCES ktc.project_user(project_id,user_id),
  FOREIGN KEY (project_id,new_assignee) REFERENCES ktc.project_user(project_id,user_id)
);
CREATE INDEX punch_event_history ON ktc.punch_item_event(project_id,punch_item_id,occurred_at,event_id);

-- Uploaded PDF bytes and page metadata are immutable: a revision is a new drawing.
CREATE FUNCTION ktc.check_page_number() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, ktc AS $$
BEGIN
  IF NEW.page_number > (SELECT page_count FROM ktc.drawing WHERE project_id=NEW.project_id AND drawing_id=NEW.drawing_id) THEN
    RAISE EXCEPTION 'Page exceeds PDF page_count' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER drawing_page_range BEFORE INSERT OR UPDATE ON ktc.drawing_page FOR EACH ROW EXECUTE FUNCTION ktc.check_page_number();

-- A PDF and all of its parsed pages must be committed together.
CREATE FUNCTION ktc.check_complete_drawing() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, ktc AS $$
DECLARE pid uuid; did uuid; expected integer; actual integer;
BEGIN
  pid := COALESCE(NEW.project_id,OLD.project_id); did := COALESCE(NEW.drawing_id,OLD.drawing_id);
  SELECT page_count INTO expected FROM ktc.drawing WHERE project_id=pid AND drawing_id=did;
  SELECT count(*) INTO actual FROM ktc.drawing_page WHERE project_id=pid AND drawing_id=did;
  IF expected IS NOT NULL AND actual <> expected THEN
    RAISE EXCEPTION 'Every PDF page must have metadata (% expected, % found)',expected,actual USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER complete_pdf AFTER INSERT OR UPDATE ON ktc.drawing DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ktc.check_complete_drawing();
CREATE CONSTRAINT TRIGGER complete_pages AFTER INSERT OR UPDATE OR DELETE ON ktc.drawing_page DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ktc.check_complete_drawing();

INSERT INTO ktc.schema_migration(version,description) VALUES (1,'Core schema, project integrity, coordinates and file metadata');
COMMIT;
