import { AbstractFiscalProvider, FetchParams, NormalizedInvoice, Page, RawInvoice } from "./AbstractFiscalProvider";
import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { HttpsCookieAgent } from "http-cookie-agent/http";

interface SiiAuthResult {
  auth: boolean;
  msg: string | null;
  token: string | null;
  rutToken?: string;
  axiosInstance: AxiosInstance | null;
}

export class ChileSIIProvider extends AbstractFiscalProvider {

  providerName = "chile_sii";
  pageSize = 300;
  maxRequestsPerSecond = 5;

  async fetchData(params: FetchParams): Promise<RawInvoice[]> {

    // await new Promise(resolve => setTimeout(resolve, 10000)); // Simulate delay for testing
    
    const authResult = await authSii(this.credentials.provider_user, this.credentials.provider_passwd);

    if (!authResult.auth || !authResult.axiosInstance) {
      throw new Error(authResult.msg ?? "SII authentication failed");
    }

    const allItems: RawInvoice[] = [];
    let currentPage = 1; let totalPages = 1;

    do {
      const response = await authResult.axiosInstance({
        url: `http://localhost:3000/getFiscalDataSII`, //sample data endpoint for testing, replace with real SII API endpoint
        method: "GET",
        params: {
          period: params.period.replace("-", "").slice(2),
          rut_receptor: authResult.rutToken,
          page: currentPage,
          page_size: this.pageSize,
        },
      });

      const dtes: any[] = Array.isArray(response.data?.records) ? response.data.records : [];
      totalPages = response.data?.totalPages ?? 1;

      const items: RawInvoice[] = dtes.map((record: any) => ({
        payload: record,
      }));

      allItems.push(...items);
      currentPage++;
    } while (currentPage <= totalPages);

    return allItems;
  }
  normalize(raw: RawInvoice, providerName: string): NormalizedInvoice {
    const r = raw.payload;
    return {
      id: Number(r.RCVID),
      rut_receptor: String(r.RUTReceptor),
      rut_emisor: String(r.RUTEmisor),
      razon_social: String(r.RazSocial),
      tipo_dte: Number(r.TipoDTE),
      folio: Number(r.Folio),
      fecha_documento: String(r.FechaDocumento),
      val_afe: Number(r.ValAfe),
      val_exe: Number(r.ValExe),
      val_iva: Number(r.ValIva),
      val_total: Number(r.ValTotal),
      estado_compra: Number(r.EstadoCompra),
      evento_receptor: r.EventoReceptor ?? "",
      evento_receptor_leyenda: r.EventoReceptorLeyenda ?? "",
      pago_contado: r.PagContado === "1" || r.PagContado === 1,
      per_cont: Number(r.PerCont),
      provider_name: providerName,
    };
  }
  async insertUpdateInvoices(orgId: string, raw: NormalizedInvoice[]): Promise<number> {
    // if invoice already exists in DB (based on unique constraints like RUT emisor, folio y tipo de documento), 
    // update all mutable fields of the record, otherwise insert new record.
    // To-Do: Implement actual DB logic here. For now, just return the count of invoices processed.
    return raw.length;
  }
}

function formatRut(rut: string): string {
  // Remove dots and existing dashes, then re-format
  const clean = rut.replace(/\./g, "").replace(/-/g, "");
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body}-${dv}`;
}

async function authSii(providerUser: string, providerPasswd: string): Promise<SiiAuthResult> {
  try {
    const rutFormatted = formatRut(providerUser);
    const rut = rutFormatted.split("-")[0].replace(".", "");
    const dv = rutFormatted.split("-")[1].replace("k", "K");

    const jar = new CookieJar();

    const axiosInstance = axios.create({
      httpsAgent: new HttpsCookieAgent({
        cookies: { jar },
        keepAlive: true,
        rejectUnauthorized: false,
      }),
    });

    //Request for auth...

    const reqPasswd = {
      url: "http://localhost:3000/sii_authenticate",
      method: "POST",
      data: {
        rut: rut,
        dv: dv,
        rutcntr: rutFormatted,
        clave: providerPasswd
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded"
      }
    };

    var response = axiosInstance(reqPasswd).then(async resPasswd => {

      try {

        var cookieArray = await jar.getCookies(reqPasswd.url);

        if (cookieArray.length == 0) {
          return { auth: false, msg: "bad SII password", token: null, axiosInstance: null };
        }

        var tokenCookie = cookieArray.find(c => c.key === "TOKEN");

        if (!tokenCookie) {
          return { auth: false, msg: "bad SII password", token: null, axiosInstance: null };
        }

        return { auth: true, msg: null, token: tokenCookie.value, rutToken: rutFormatted, axiosInstance: axiosInstance };

      } catch (err) {
        return { auth: false, msg: "bad SII password", token: null, axiosInstance: null };
      }

    })

    return {
      auth: true,
      msg: null,
      token: "ABCDEFGHIJKLMNOPQRSTUV",
      rutToken: rutFormatted,
      axiosInstance,
    };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("SII auth error:", message);
    return { auth: false, msg: "Error auth on SII: " + message, token: null, axiosInstance: null };
  }
}