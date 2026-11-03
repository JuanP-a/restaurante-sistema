import { createPrinterSettingsRoutes, realPrinterRouteDeps } from "@/infra/printer/http-routes";

const routes = createPrinterSettingsRoutes(realPrinterRouteDeps());

export const POST = routes.TEST;
