import { dataProcessingQueue } from './queues';
import processDataJob from './processors/dataProcessor';
import { updateJobStatus } from './utils/queueHelper';
import Bull from 'bull';

// Set up processors with retry logic and concurrency
const CONCURRENCY = 10;
dataProcessingQueue.process(CONCURRENCY, processDataJob);

// Global error handlers for each queue
const setupErrorHandlers = (queue: Bull.Queue) => {
    queue.on('failed', async (job, err) => {
        console.error(`Job ${job.id} in ${queue.name} queue failed:`, err.message);
        await updateJobStatus(job.id, queue.name, {
            status: job.attemptsMade >= (job.opts.attempts ?? 0) ? 'failed' : 'waiting',
            attempts: job.attemptsMade,
            error: err.message,
        });
    });

    queue.on('completed', async (job) => {
        console.log(`Job ${job.id} in ${queue.name} queue completed`);
    });

    queue.on('stalled', async (job) => {
        console.warn(`Job ${job.id} in ${queue.name} queue has stalled`);
        await updateJobStatus(job.id, queue.name, {
            status: 'stalled',
        });
    });
};

// Set up error handlers for all queues
setupErrorHandlers(dataProcessingQueue);

console.log('Worker started processing jobs...');