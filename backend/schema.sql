DROP TABLE IF EXISTS mindmaps;
DROP TABLE IF EXISTS folders;

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE mindmaps (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  data TEXT NOT NULL,
  folder_id TEXT,
  share_token TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE INDEX idx_mindmaps_updated_at ON mindmaps(updated_at DESC);
CREATE INDEX idx_mindmaps_folder_id ON mindmaps(folder_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_mindmaps_share_token ON mindmaps(share_token);
