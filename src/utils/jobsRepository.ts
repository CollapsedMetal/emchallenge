import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Initialize PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function getJobById(jobId: string) {
    const result = await pool.query('SELECT * FROM jobs WHERE job_id = $1', [jobId]);
    return result.rows[0] || null;
}

async function getJobsByStatus(status: string, limit: number = 100, offset: number = 0) {
    const result = await pool.query(
        'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [status, limit, offset]
    );
    return result.rows;
}

async function getJobsByQueue(queueName: string, limit: number = 100, offset: number = 0) {
    const result = await pool.query(
        'SELECT * FROM jobs WHERE queue_name = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [queueName, limit, offset]
    );
    return result.rows;
}

async function getJobStats() {
    const result = await pool.query(`
    SELECT
      queue_name,
      status,
      COUNT(*) as count
    FROM jobs
    GROUP BY queue_name, status
    ORDER BY queue_name, status
  `);
    return result.rows;
}

async function hasActiveJobsForOrg(orgId: string, queueName: string): Promise<boolean> {
    const result = await pool.query(
        `SELECT 1 FROM jobs WHERE org_id = $1 AND queue_name = $2 AND status IN ('active', 'pending') LIMIT 1`,
        [orgId, queueName]
    );
    return result.rows.length > 0;
}

export { getJobById, getJobsByStatus, getJobsByQueue, getJobStats, hasActiveJobsForOrg };
