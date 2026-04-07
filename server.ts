import express, { Request, Response } from 'express';
import axios from 'axios';
import { dataProcessingQueue } from './src/queues';
import { addJob, updateJobStatus } from './src/utils/queueHelper';
import {
    getJobById,
    getJobsByStatus,
    getJobsByQueue,
    getJobStats,
    hasActiveJobsForOrg,
} from './src/utils/jobsRepository';

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

const app = express();
app.use(express.json());

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/queues');

createBullBoard({
    queues: [new BullAdapter(dataProcessingQueue)],
    serverAdapter,
});

app.use('/queues', serverAdapter.getRouter());
const port = process.env.PORT || 3000;


// curl -X GET http://localhost:3000/extractFiscalData \
//   -H "Content-Type: application/json" \
//   -d '{
//     "orgId": "org-666",
//     "period": "2026-03",
//     "options": { "provider_name": "chile_sii", "priority": "1" }
//   }'

app.get('/extractFiscalData', async (req: Request, res: Response) => {

    try {
        const { orgId, period, options } = req.body;

        if (!orgId || !period || !options || !options.provider_name) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        //Check if there are active, pending jobs for this org, if yes, skip execution
        const hasPending = await hasActiveJobsForOrg(orgId, 'fiscal-data-extraction');
        if (hasPending) {
            console.log(`Skipping: org ${orgId} already has active, pending jobs`);
            res.status(200).json({ skipped: true, reason: 'existing active, pending, or delayed job for this org' });
            return;
        }

        //add job to queue and record job status in DB
        const job = await addJob(
            orgId,
            dataProcessingQueue,
            { orgId, period, options },
            {
                attempts: 3,
                backoff: {
                    type: 'fixed',
                    delay: 5000,
                },
                priority: parseInt(options.priority) ?? null,
            }
        );

        res.status(201).json({
            message: 'Fiscal data extraction job added to queue',
            jobId: job.jobId,
        });
    } catch (error) {
        console.error('Error adding fiscal data extraction job:', error);
        res.status(500).json({ error: 'Failed to add job to queue' });
    }
});


// curl -X POST http://localhost:3000/extractFiscalDataAddSchedule \
//   -H "Content-Type: application/json" \
//   -d '{
//     "orgId": "org-666",
//     "options": { "provider_name": "chile_sii", "priority": "1", "cron": "* * * * *", "timeZone": "America/Santiago" }
//   }'

app.post('/extractFiscalDataAddSchedule', async (req: Request, res: Response) => {

    try {
        const { orgId, options } = req.body;

        if (!orgId || !options || !options.provider_name || !options.cron || !options.timeZone) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        //add jobs to queue with cron schedule and record job status in DB
        const jobs = await addJob(
                orgId,
                dataProcessingQueue,
                { orgId, period: null, options },
                {
                    repeat: { 
                        cron: options.cron,
                        tz: options.timeZone
                    },
                    attempts: 3,
                    backoff: {
                        type: 'fixed',
                        delay: 5000,
                    },
                    priority: parseInt(options.priority) ?? null,
                }
            )
            
        res.status(201).json({
            message: 'Fiscal data extraction job scheduled',
            jobId: jobs.jobId,
        });

    } catch (error) {
        console.error('Error adding fiscal data extraction job:', error);
        res.status(500).json({ error: 'Failed to add job to queue' });
    }
});


// curl -X POST http://localhost:3000/extractFiscalDataRemoveSchedule \
//   -H "Content-Type: application/json" \
//   -d '{
//     "jobId": "repeat:f5d08e0856db774802956ca50c3d1dff:1775377620000"
//   }'

app.post('/extractFiscalDataRemoveSchedule', async (req: Request, res: Response) => {

    try {
        const { jobId } = req.body;

        if (!jobId) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        console.log(jobId);

        //clean job via Bull Board API
        await axios.put(`http://localhost:${port}/queues/api/queues/fiscal-data-extraction/${encodeURIComponent(jobId)}/clean`);

        await updateJobStatus(jobId, 'fiscal-data-extraction', { status: 'removed' });

        res.status(200).json({
            message: 'Fiscal data extraction job removed from schedule',
            jobId: jobId,
        });


    } catch (error) {
        console.error('Error removing fiscal data extraction job:', error);
        res.status(500).json({ error: 'Failed to remove job from schedule' });
    }
});

app.get('/getFiscalDataSII', async (req: Request, res: Response) => {

    try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(__dirname, 'sample_data.json');
        const allData: any[] = JSON.parse(await fs.readFile(filePath, 'utf8'));

        const period = req.query.period as string | undefined;
        const rutReceptor = req.query.rut_receptor as string | undefined;

        const data = allData.filter((r) => {
            if (period && r.PerCont !== period) return false;
            if (rutReceptor && r.RUTReceptor !== rutReceptor) return false;
            return true;
        });

        const pageSize = 300;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const totalRecords = data.length;
        const totalPages = Math.ceil(totalRecords / pageSize);
        const start = (page - 1) * pageSize;
        const records = data.slice(start, start + pageSize);

        res.json({
            page,
            pageSize,
            totalRecords,
            totalPages,
            records,
        });
    } catch (error) {
        console.error('Error reading sample data:', error);
        res.status(500).json({ error: 'Failed to read sample data' });
    }
});

app.post('/sii_authenticate', async (req: Request, res: Response) => {
    res.status(200).json({ auth: true });
});

// Get job status
app.get('/jobs/:id', async (req: Request, res: Response) => {
    try {
        const job = await getJobById(req.params.id as string);
        if (!job) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(job, null, 2));
    } catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).json({ error: 'Failed to fetch job' });
    }
});

// Get jobs by status
app.get('/jobs/status/:status', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        const jobs = await getJobsByStatus(req.params.status as string, limit, offset);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(jobs, null, 2));
    } catch (error) {
        console.error('Error fetching jobs by status:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Get jobs by queue
app.get('/jobs/queue/:queue', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        const jobs = await getJobsByQueue(req.params.queue as string, limit, offset);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(jobs, null, 2));
    } catch (error) {
        console.error('Error fetching jobs by queue:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Get job stats
app.get('/stats', async (_req: Request, res: Response) => {
    try {
        const stats = await getJobStats();
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('Error fetching job stats:', error);
        res.status(500).json({ error: 'Failed to fetch job stats' });
    }
});

app.listen(port, () => {
    import('./src/worker');
    console.log(`API server listening on port ${port}`);
});
