-- SQL script to create the 'jobs' table for storing job information
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  org_id VARCHAR(10) NOT NULL,
  queue_name VARCHAR(100) NOT NULL,
  data JSONB,
  status VARCHAR(50) NOT NULL,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3
);