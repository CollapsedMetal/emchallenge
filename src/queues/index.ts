import Bull from 'bull';
import dotenv from 'dotenv';
dotenv.config();

// Create queues
const dataProcessingQueue = new Bull('fiscal-data-extraction', process.env.REDIS_URL!);

export { dataProcessingQueue };
