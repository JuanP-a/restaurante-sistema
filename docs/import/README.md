# Import de menú — datos reales del primer cliente

Menú del primer cliente: **Lilian's Hamburguesas** (Mexicali/Baja). Transcripción
de 3 fotos (2 páginas del menú + hoja de combos) a `lilians-menu.json`.

Este formato es el insumo esperado por `POST /api/admin/import` (spec §6.4). El
spec todavía define un formato mínimo; acá se documentan las extensiones y las
decisiones resueltas con el cliente.

## Formato propuesto

```jsonc
{
  "categories": [
    {
      "name": "Hamburguesas",
      // ingredientes que el producto incluye por defecto (nivel categoría)
      "includes": "Lechuga, jitomate, mayonesa, catsup, mostaza y chile jalapeño",
      // extras elegibles con precio (nivel categoría)
      "extras": [{ "name": "Tocino", "price": "10" }],
      // grupos de opciones de elección (nivel categoría o producto)
      "optionGroups": [
        { "name": "Sabor", "selection": "single", "options": ["Búfalo", "BBQ"] }
      ],
      "products": [
        { "name": "Sencilla", "basePrice": "55", "description": "Carne, jamón y queso amarillo" }
      ]
    }
  ],
  "deliveryZones": []
}
```

Diferencias contra spec §6.4:

- `includes` (string, opcional) — ingredientes por defecto de la categoría.
  Soporta "quitar ingrediente".
- `extras` (array, opcional) — extras elegibles con precio. Hoy solo
  Hamburguesas.
- `optionGroups` (array, opcional) — grupos de opciones. `selection: "single"`
  (una sola opción). Se puede declarar a nivel categoría (aplica a todos sus
  productos) o producto (sobreescribe/agrega).
- `basePrice` como string decimal (`"55"`, `"105"`) para no perder precisión.
- `deliveryZones` vacío hoy — zonas aún no definidas.

`optionGroups` requiere modelo y UI que aún no existen; se apoya en el trabajo
de modificadores (rama pausada `feature/modifiers-completion`). El import
inicial puede persistir el menú sin resolver las opciones si se decide
diferirlo.

## Decisiones resueltas con el cliente

- **Combos**: producto con **precio fijo** (no receta que arma otros productos).
- **Ingredientes por defecto** por categoría (campo `includes`):
  - Hamburguesas: lechuga, jitomate, mayonesa, catsup, mostaza y chile jalapeño.
  - Hot Dogs: jitomate, cebolla, mayonesa, catsup, mostaza y chile jalapeño.
  - Tortas: lechuga, jitomate, aguacate, mayonesa y chile jalapeño.
  - Quesadillas: lechuga, jitomate y salsa.
  - Otros (Papas, Alitas, Complementos, Combos): sin `includes`.
- **"Ingrediente Extra" ($10) aplica solo a Hamburguesas.** Modelado como
  `extras` de la categoría Hamburguesas (aros de cebolla, piña, tocino, queso,
  $10 cada uno). Ya no es un producto de "Complementos y Extras".
- **Sincronizadas**: la variación de precio es por proteína:
  - Jamón, Salchicha, Chorizo, Pierna → $45
  - Arrachera, Pastor, Alambre → $55
  - Camarón → $65
  Modeladas como productos separados (el precio no es único).
- **Alitas**: se venden en 8 piezas ($110) y 4 piezas ($55), con sabor elegible
  (Búfalo, BBQ, Mango Habanero). Una sola opción por orden.
- **Boneless**: sabor elegible (Natural, BBQ, Búfalo, Mango Habanero). **No**
  aplica mitad de orden (no se dividen sabores).
- **Quitar ingredientes**: el modelo lo soporta (`includes`); la **UX/UI** por
  categoría de alimento se resuelve en implementación posterior. No bloquea el
  import.

## Fuera de alcance del import inicial

- **Zonas de entrega**: no definidas aún. Se cargan en otra implementación
  (`deliveryZones: []`).
- **UX/UI de personalización** (quitar ingredientes, elegir sabores, agregar
  extras): posterior; aunque el formato ya declara la intención.

## Próximo paso

Escribir el plan del Import de menú (`docs/superpowers/plans/…`) con este
formato, y actualizar spec §6.4 para incluir `includes`/`extras`/`optionGroups`.
