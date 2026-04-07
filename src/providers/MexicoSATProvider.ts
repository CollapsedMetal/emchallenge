import { AbstractFiscalProvider, FetchParams, NormalizedInvoice, Page, RawInvoice } from "./AbstractFiscalProvider";

export class MexicoSATProvider extends AbstractFiscalProvider {
  providerName = "mexico_sat";

  async fetchData(params: FetchParams): Promise<RawInvoice[]> {
    // Implementar llamada HTTP con autenticación, paginación y mapeo a RawInvoice
    return [] as RawInvoice[];
  }

  normalize(raw: RawInvoice, providerName: string): NormalizedInvoice {
    // Mapear campos SAT -> NormalizedInvoice
    return {
      id: 0,
      rut_receptor: "",
      rut_emisor: "",
      razon_social: "",
      tipo_dte: 0,
      folio: 0,
      fecha_documento: "",
      val_afe: 0,
      val_exe: 0,
      val_iva: 0,
      val_total: 0,
      estado_compra: 0,
      evento_receptor: "",
      evento_receptor_leyenda: "",
      pago_contado: false,
      per_cont: 0,
      provider_name: providerName,
    };
  }

  async insertUpdateInvoices(orgId: string, raw: NormalizedInvoice[]): Promise<number> {
    return raw.length;
  }
}