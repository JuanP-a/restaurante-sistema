import { createPrinterSettingsRoutes, realPrinterRouteDeps } from "@/infra/printer/http-routes";

const routes = createPrinterSettingsRoutes(realPrinterRouteDeps());

export const GET = routes.GET;
export const PUT = routes.PUT;
