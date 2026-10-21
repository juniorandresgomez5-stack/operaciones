# Analítica de proyectos y cajas

Prototipo web local separado por responsabilidades para que la interfaz sea fácil de modificar:

- `index.html`: estructura de las pantallas, formularios, tablas y plantillas visuales de las tarjetas.
- `css/styles.css`: colores, tamaños, distribución y adaptación a móvil; aquí se ajusta la apariencia.
- `js/configuracion-proyectos.js`: nombres, valores iniciales y metas de ejemplo.
- `js/almacenamiento-local.js`: lectura y guardado de datos en el navegador.
- `js/calculos.js`: cálculos de cumplimiento, acumulados y cajas restantes.
- `js/controlador-interfaz.js`: comportamiento, eventos, formularios, filtros, gráficos e historial.

Las tarjetas de proyecto y las barras del resumen tienen su marcado en plantillas `<template>` al final de `index.html`. `controlador-interfaz.js` clona esas plantillas y coloca los datos; el diseño permanece en HTML y CSS. Los SVG de gráficos se dibujan desde JavaScript porque cambian según el proyecto y las fechas elegidas.

Los archivos JavaScript tienen comentarios en español para ubicar qué hace cada módulo y dónde modificar proyectos de ejemplo, cálculos, almacenamiento, formularios, historial y gráficos.

## Abrir en Visual Studio Code

Abre esta carpeta en VS Code y sirve `index.html` con Live Server. También puedes ejecutar `npx serve .` desde una terminal en esta carpeta. Como usa módulos JavaScript, debe abrirse desde un servidor local, no haciendo doble clic en el archivo.

## Proyectos y metas

Cada proyecto tiene un nombre editable, cajas iniciales, meta diaria fija, meta global de procesamiento y fecha límite. Las metas se configuran en la pantalla **Proyectos**; no se cambian al registrar movimientos.

La pantalla **Registro diario** permite elegir proyecto y fecha e ingresar cajas recibidas y procesadas. Cada guardado se añade como un movimiento individual, por lo que varias recepciones durante el mismo día se acumulan en lugar de reemplazarse. El registro guarda una copia del nombre y de las metas diaria y global vigentes para conservar evidencia si luego se cambia la configuración.

El saldo del proyecto se calcula como:

`cajas iniciales + recibidas acumuladas − procesadas acumuladas`

El cumplimiento diario compara las procesadas del día con la meta diaria fija del proyecto. El avance global suma las procesadas de todos los días de ese proyecto y las compara con su meta global; el panel muestra cuántas faltan. Cada cálculo se mantiene separado por proyecto.

## Metas iniciales

Los nombres, cantidades y fechas de `js/configuracion-proyectos.js` son ejemplos que debes reemplazar por los valores reales. Las metas diarias comienzan en cero porque no se proporcionaron cantidades. Puedes editar nombres y metas desde **Proyectos** para experimentar.

## Evidencia e historial

El historial presenta resúmenes diarios y cada movimiento individual, con fecha, proyecto, metas registradas y cantidades recibidas y procesadas. Puedes filtrar por proyecto y fecha y exportar las filas de evidencia a CSV compatible con Excel.

El módulo **Gráficos diarios** permite elegir un proyecto y un rango de fechas. Las barras comparan, por fecha, la meta diaria fija (gris) con las cajas procesadas: ámbar significa que faltaron, verde que se cumplió y azul que se superó. El porcentaje de cumplimiento aparece debajo de cada fecha y al pasar el cursor sobre las barras se ven las cajas y el faltante o excedente. La línea conservada muestra el avance acumulado hacia la meta global, con una referencia punteada del 100 %. La tabla inferior contiene el detalle exacto.

Los datos se guardan en el `localStorage` del navegador actual; no se sincronizan entre personas, navegadores o dispositivos. Registros globales de modulación de versiones previas se conservan localmente, pero no se asignan automáticamente a proyectos.
