import { Pool, PoolClient } from 'pg';
import Bull from 'bull';
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

interface JobUpdates {
    [key: string]: string | number | undefined;
}

// Helper function to add a job to a queue and record it in Postgres
async function addJob(orgId: string, queue: Bull.Queue, data: Record<string, unknown>, options: Bull.JobOptions = {}) {
    const client: PoolClient = await pool.connect();
    try {
        await client.query('BEGIN');

        // Add job to Bull queue
        const job = await queue.add(data, options);

        // Record job in Postgres
        const result = await client.query(
            `INSERT INTO jobs (job_id, org_id, queue_name, data, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
            [job.id.toString(), orgId, queue.name, JSON.stringify(data), 'pending']
        );

        await client.query('COMMIT');
        return {
            jobId: job.id,
            dbId: result.rows[0].id,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Helper function to update job status in Postgres
async function updateJobStatus(jobId: string | number, queueName: string, updates: JobUpdates) {
    const client: PoolClient = await pool.connect();
    try {
        // Build the SET clause based on provided updates
        const setClauses: string[] = [];
        const values: (string | number | undefined)[] = [jobId, queueName];
        let paramIndex = 3;

        for (const [key, value] of Object.entries(updates)) {
            setClauses.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }

        if (setClauses.length === 0) {
            return;
        }
        
        const setClause = setClauses.join(', ');

        await client.query(
            `UPDATE jobs
       SET ${setClause}
       WHERE job_id = $1 AND queue_name = $2`,
            values
        );
    } finally {
        client.release();
    }
}

export { addJob, updateJobStatus };
