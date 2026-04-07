export type Page<T> = { items: T[]; nextCursor?: string | null };

export interface NormalizedInvoice {
  id: number;
  rut_receptor: string;
  rut_emisor: string;
  razon_social: string;
  tipo_dte: number;
  folio: number;
  fecha_documento: string; // ISO date string
  val_afe: number;
  val_exe: number;
  val_iva: number;
  val_total: number;
  estado_compra: number;
  evento_receptor: string;
  evento_receptor_leyenda: string;
  pago_contado: boolean;
  per_cont: number;
  provider_name: string;
}

export interface FetchParams {
  orgId: string;
  period: string; // e.g. "2026-01" for January 2026
  since?: string; // ISO timestamp for incremental fetch
  until?: string; // ISO timestamp
  cursor?: string; // provider-specific pagination cursor
  pageSize?: number;
}

export interface ProviderCredentials {
  provider_user: string; //RUT for Chile SII, RFC for Mexico SAT, etc
  provider_passwd: string; 
}

export interface RawInvoice {
  payload: any; // raw provider response in JSON
}

export abstract class AbstractFiscalProvider {
  readonly providerName: string | undefined;

  constructor(protected credentials: ProviderCredentials) {}

  /** Fetch a single page of raw invoices. Must respect provider pagination and rate limits. */
  abstract fetchData(params: FetchParams, credentials: ProviderCredentials): Promise<RawInvoice[]>;

  /** Normalize a raw invoice into NormalizedInvoice canonical model. */
  abstract normalize(raw: RawInvoice, providerName: string): NormalizedInvoice;

  /** Insert or update the normalized invoices into the database, associated with the given orgId. */
  abstract insertUpdateInvoices(orgId: string, raw: NormalizedInvoice[]): any;
}