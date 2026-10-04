# Mockups

Prototipos HTML estáticos (Tailwind por CDN, sin build). Sirven para iterar UI/UX rápido antes de portarla a componentes Next.js reales. No son código de producción y no se importan desde `src/`.

## `menu-modifiers.html`

Mockup de la **captura de pedido con modificadores** (flujo "menú → producto → personalizar → carrito"), pensado para el operador del local en tablet/celular.

- Tabs por categoría, grid de productos, sheet de personalización con **toggles** (extras con precio, ingredientes removibles).
- Carrito lateral con subtotal/envío/total.
- Datos de ejemplo en un `<script>` al final del archivo (categorías, productos, extras, removibles).

Debe usarse como **referencia de interacción y de estructura de datos** (qué campos tiene un producto: `name`, `price`, `extras[]`, `removes[]`) al implementar la fase de modificadores y, potencialmente, al definir el **formato JSON de import de menú**.
