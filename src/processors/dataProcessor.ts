import Bull from 'bull';
import { updateJobStatus } from '../utils/queueHelper';
import { ChileSIIProvider } from '../providers/ChileSIIProvider';
import { MexicoSATProvider } from '../providers/MexicoSATProvider';
import { NormalizedInvoice, ProviderCredentials, RawInvoice } from '../providers/AbstractFiscalProvider';

async function processData(orgId: string, period: string, options: any) {
    
    let provider: ChileSIIProvider | MexicoSATProvider | null = null

    //get credentials for provider for org from DB
    const credentials: ProviderCredentials = await getCredentialsForProvider(orgId, options.provider_name);

    switch (options.provider_name) {
        case 'chile_sii':
            provider = new ChileSIIProvider(credentials);
            break;
        case 'mexico_sat':
            provider = new MexicoSATProvider(credentials);
            break;
        default:
            throw new Error(`Unsupported provider: ${options.provider_name}`);
    }

    if(period === null) {
        // Calculate current period (YYYY-MM)
        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        period = currentPeriod;
    }

    //fetch data from provider API, normalize it
    const normalized_invoices : NormalizedInvoice[] = await provider.fetchData({ orgId: orgId, period: period }).then((data: RawInvoice[]) => {

        const n_invoices : NormalizedInvoice[] = [];

        if(data.length > 0) {

            data.forEach(async raw => {

                //Normalize raw invoice data into common format defined by NormalizedInvoice interface
                const normalized : NormalizedInvoice = provider.normalize(raw, provider.providerName);

                n_invoices.push(normalized);
            });
        }

        return n_invoices;

    }).catch((err: any) => {
        console.error('Error fetching data:', err);
        throw err;
    });

    // if invoice already exists in DB (based on unique constraints like RUT emisor, folio y tipo de documento), 
    // update all mutable fields of the record, otherwise insert new record.
    const q_dtes_sync = await provider.insertUpdateInvoices(orgId, normalized_invoices); 

    return {
        q_dtes_sync: q_dtes_sync,
        timestamp: new Date(),
    };
}

async function processDataJob(job: Bull.Job) {
    try {
        await updateJobStatus(job.id, 'fiscal-data-extraction', {
            status: 'active',
            started_at: new Date().toISOString(),
        });

        const { orgId, period, options } = job.data;

        const result = await processData(orgId, period, options);

        if (job.id.toLocaleString().includes('repeat')) {
            console.log(`Completed scheduled job ${job.id} for org ${orgId} with result:`, result);
            await updateJobStatus(job.id, 'fiscal-data-extraction', {
                status: 'delayed',
                result: JSON.stringify(result),
                completed_at: new Date().toISOString(),
            });
        } else {
            console.log(`Completed one-time job ${job.id} for org ${orgId} with result:`, result);
            await updateJobStatus(job.id, 'fiscal-data-extraction', {
                status: 'completed',
                result: JSON.stringify(result),
                completed_at: new Date().toISOString(),
            });
        }

        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateJobStatus(job.id, 'fiscal-data-extraction', {
            status: 'failed',
            error: message,
            completed_at: new Date().toISOString(),
        });
        throw error;
    }
}

//Get provider credentials from DB
async function getCredentialsForProvider(orgId: string, provider_name: any): Promise<ProviderCredentials> {
    return new Promise((resolve) => {
        resolve({
            provider_user: "55555555-5",
            provider_passwd: `xxxxxxxxxx`,
        });
    });
}

export default processDataJob;