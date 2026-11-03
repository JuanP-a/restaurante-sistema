# Runbook — verificación de hardware y entrega de la v1

**Fecha de redacción:** 2026-11-03
**Estado:** pendiente (la hace el usuario; no hay impresora ni memoria USB conectadas al entorno de desarrollo).
**Cierra:** [DT-048](../deuda-tecnica.md) (térmica), [DT-018](../deuda-tecnica.md) (USB), y deja resuelto o decidido [DT-050](../deuda-tecnica.md) (Smart App Control) y el acceso desde celular.

Todo lo demás de la v1 ya está verificado sin hardware: impresora 21/21 y backup/USB 8/8 sobre el `.exe` real ([runbook impresora](2026-11-03-desktop-v1-impresora.md), [runbook USB](2026-11-03-desktop-v1-usb.md)). Aquí solo queda lo que necesita un dispositivo físico.

## 0. Antes de empezar

**La PC donde corre la app** (la del local, o la tuya para ensayar):
- Instalar con `Sistema de Pedidos Setup 0.1.0.exe` (`pnpm electron:dist` lo genera en `dist\`). Se instala por usuario y deja elegir la carpeta. Nunca se ha ejecutado el instalador, solo `win-unpacked`: anota cualquier incidencia.
- **Smart App Control:** Seguridad de Windows → Control de aplicaciones y del navegador → Configuración de Smart App Control. Si está **Activado**, el `.exe` y el instalador no se ejecutarán (sin firma, DT-050). Opciones en la DT-050; **no** desactivarlo en el equipo del cliente sin decidirlo.
- La PC debe estar encendida, sin suspensión y en la misma red que la impresora y los celulares.

**La térmica:**
- 80 mm, ESC/POS, con puerto Ethernet y puerto raw **9100** (el estándar de las térmicas de red).
- **IP fija**: reserva DHCP en el router o IP estática en la impresora. Si la IP cambia, todas las comandas fallan con error hasta reconfigurarla.
- Codepage **CP850** elegido en la propia impresora (el menú varía por modelo; consulta su manual).
- Casi todas imprimen una página de autodiagnóstico con su IP (suele hacerse manteniendo el botón FEED al encenderla; depende del modelo). Úsala para confirmar la IP.

**El resto:** una o dos memorias USB (mejor si una tiene interruptor de solo lectura), si tienes un disco duro USB, y un celular en la misma WiFi.

**Si el `.exe` no arranca en la PC de ensayo** (bloqueo de Smart App Control), el servidor se puede ejecutar sin Electron. Es la vía que sí se verificó (9/9 en el [runbook USB](2026-11-03-desktop-v1-usb.md)); `pnpm start` **no** se ha probado con `output: standalone`:

```powershell
pnpm build; node scripts/pack-standalone.mjs      # genera dist-standalone/
cd dist-standalone
# PORT=3210 HOSTNAME=0.0.0.0 NODE_ENV=production DB_DRIVER=pglite
# DB_PATH=<carpeta de datos> MIGRATIONS_PATH=<dist-standalone>\drizzle
# SESSION_SECRET=<32+ caracteres> SESSION_COOKIE_SECURE=false
# BACKUP_DIR=<carpeta de backups> NODE_PATH=<dist-standalone>\vendor
node server.js
```

Después se entra a `http://localhost:3210`. No cubre el tray ni el autostart.

## 1. Orden sugerido

| # | Qué | Por qué en este orden |
|---|---|---|
| 1 | Smart App Control e instalación | Si no arranca, nada de lo demás se puede probar |
| 2 | Térmica (sección A) | Es lo que bloquea la entrega |
| 3 | USB (sección B) | Independiente de la térmica |
| 4 | Celular por la LAN (sección C) | Usa la térmica ya configurada |
| 5 | Decisiones abiertas (sección D) | Con lo visto en papel |

## A. Térmica (DT-048)

En `/admin/ajustes` escribe la IP y el puerto (9100).

- [ ] **Imprimir prueba** (con los valores del formulario, sin guardar): sale papel y el estado dice "Prueba enviada: revisa el papel."
- [ ] El ticket de prueba trae "PRUEBA DE IMPRESIÓN" en negrita y centrado, la fecha, y la línea `áéíóú ñ ¿¡` **bien impresa**. Si los acentos salen como símbolos raros, el codepage de la impresora no es CP850.
- [ ] La impresora **corta** el papel al final.
- [ ] Recargar `/admin/ajustes`: como solo se probó, el campo de IP sigue vacío (la prueba no guarda).
- [ ] **Guardar**: aparece "Guardado." y al recargar la IP persiste.
- [ ] Crear un pedido en `/admin/orders/new` con varios productos, alguno con nombre largo o con acentos. En el detalle del pedido, **Reimprimir comanda**: sale en la térmica **sin diálogo de impresión del navegador**; trae LOCAL o DOMICILIO, `PEDIDO #n`, la fecha, los productos y **sin precios**.
- [ ] **Reimprimir cuenta**: trae el encabezado del negocio, los productos con precio, `SUBTOTAL`, `ENVIO` y `TOTAL`, y los importes quedan alineados a la derecha.
- [ ] Ancho: ningún renglón se parte ni se desborda a la siguiente línea (el ancho es de 48 columnas).
- [ ] Apagar la impresora o desenchufar el cable y pulsar **Imprimir prueba**: aparece un error claro (ver tabla de errores).
- [ ] Con la impresora apagada, **Reimprimir comanda** da error y no se queda colgado.
- [ ] Anotar qué nombre de negocio sale en la cuenta (hoy `Mi Restaurante` por defecto; es lo pendiente de DT-047, ver sección D).

**Errores esperados** (si ves otro, anótalo):

| Mensaje | Causa probable |
|---|---|
| "No se pudo conectar con la impresora X:9100. Revisa la IP y que esté encendida" | IP equivocada, impresora apagada, otra red, o puerto 9100 cerrado |
| "La impresora X:9100 no respondió a tiempo. Revisa que esté encendida y en la misma red" | La IP existe pero nadie responde en 3 s (red distinta, aislamiento del WiFi) |
| "Se perdió la conexión con la impresora X:9100" | Se cortó a mitad de impresión |
| "La IP no es válida. Escríbela sin http:// ni puerto" | Error de tecleo; no se guarda nada |

## B. USB (DT-018)

Seguir los **7 pasos** de la sección "Verificación de hardware (pendiente — usuario)" del [runbook USB](2026-11-03-desktop-v1-usb.md). La fuente de verdad es esa lista; no se duplica aquí para que no diverja. Resumen de lo que se comprueba: la memoria aparece como `USB (E:\)` al conectarla, el backup llega a la carpeta **y** a `E:\restaurante-backups\`, el backup del USB se valida, una unidad de solo lectura no se ofrece, un disco duro USB sí, y al retirarla desaparece sin romper el backup a carpeta.

Cada listado de destinos tarda alrededor de 1 s (lanza PowerShell); es esperable.

## C. El PC del local y los celulares

- [ ] **Instalar** con `Setup.exe`: termina sin errores y abre la app. El primer arranque muestra el asistente de contraseña.
- [ ] Windows pide permitir el acceso a la red al primer arranque: **permitir en redes privadas**. Si no pidió nada, comprobar que existen reglas de entrada para `sistema de pedidos.exe`.
- [ ] En `/admin/conectar` aparece la URL `http://<IP-de-la-PC>:3210` y el QR. El puerto puede ser otro si el 3210 está ocupado: usar el que muestre.
- [ ] **Desde un celular en la misma WiFi**: escanear el QR (o escribir la URL), iniciar sesión y crear un pedido.
- [ ] **Desde el celular**: en el detalle del pedido, **Reimprimir comanda**: la comanda sale en la térmica (impresión del servidor) y el celular **no** abre un diálogo de impresión.
- [ ] Cerrar la ventana de la app en la PC: el celular sigue entrando (la app sigue en la bandeja).

Si el celular no conecta: ¿la red de Windows está como **Privada** y no **Pública**?, ¿el cortafuegos permite la app?, ¿la WiFi tiene activado el aislamiento de clientes (frecuente en redes de invitados)?

**Opcional (v2, no bloquea la entrega):** "Reiniciar servidor" desde la bandeja; "Iniciar con Windows" y reiniciar Windows; comprobar que tras el reinicio la app vuelve a estar en `:3210`.

## D. Decisiones abiertas antes de entregar

| Decisión | Dónde está | Qué hace falta |
|---|---|---|
| **Auto-print** al crear un pedido | [spec impresora](../superpowers/specs/2026-11-03-desktop-v1-01-config-impresora-design.md), "Pregunta abierta" | Hoy se imprime pulsando "Reimprimir comanda". Preguntar al cliente si espera que salga sola; si sí, actualizar el ADR 0005 y hacerlo (cambio pequeño en `POST /api/orders`). |
| **Nombre del negocio** en los tickets (`BUSINESS_*`) | DT-047 (resto, v2) | La cuenta sale con "Mi Restaurante". Si el cliente quiere su nombre, dirección y teléfono, entra en la v1 (hoy solo se configuran por variables de entorno que el `.exe` no lee). |
| **Smart App Control** del PC del cliente | DT-050 | Comprobarlo (sección 0). Si está activado, firmar el binario o decidir otra vía. |
| **Endurecer el middleware** (default-deny) | DT-049, prioridad Alta | Fuera del alcance de la v1; recomendado antes de exponer la app en una red que no sea de confianza. |

## Cómo registrar los resultados y cerrar las deudas

Marca las casillas de arriba y escribe aquí lo que pase. Después se actualizan los registros.

| Prueba | Fecha | Resultado | Notas / modelo de impresora / letra de la unidad |
|---|---|---|---|
| A. Térmica |  |  |  |
| B. USB |  |  |  |
| C. Instalación y celular |  |  |  |

- **DT-048** pasa a `Resuelta` cuando la comanda y la cuenta salen bien (acentos, 48 columnas, corte). Si falla algo, se abre una DT con el síntoma concreto (modelo, qué salió en el papel).
- **DT-018** pasa a `Resuelta` cuando se cumplan los 7 pasos de USB.
- **DT-050** sigue abierta mientras exista un PC de destino con Smart App Control activo.
- Cualquier sorpresa (algo distinto de lo esperado) va a `hallazgos.md` como un `H-NNN` nuevo: es el dato más perecedero.
