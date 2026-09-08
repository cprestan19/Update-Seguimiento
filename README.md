# ToolsIT Control Center

Panel de control operativo para el seguimiento de proyectos con múltiples
ubicaciones (checklist por etapas, asignación de personal, incidencias,
inventario/costo y estado en tiempo real). Actualmente en uso por ASW Group
para la migración de Retail Pro v9 a Prism 2.2 en 52 tiendas (Panamá, Zona
Libre, Aeropuerto, Uruguay, Curazao, Aruba, St. Maarten, Belice, El Salvador
y Honduras), pero está pensado para reutilizarse en otros rollouts.

Incluye:

- Autenticación con usuario/contraseña y dos roles: **ADMIN** y **USER**.
- Módulo de equipo: alta de técnicos, auditores TI y auditores de inventario.
- Dashboard con KPIs, filtros y tabla de las 52 tiendas (ya cargadas desde tu Excel).
- Ficha de tienda con checklist por categorías, asignación de personal, e incidencias.
- Registro de auditoría de cada acción (login, asignación, checklist, incidencias).

Stack: **Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL + NextAuth + Tailwind**.

---

## 1. Requisitos previos

- Node.js 18 o superior (`node -v`)
- PostgreSQL 14 o superior, corriendo localmente o accesible por red
- npm (viene con Node)

---

## 2. Crear la base de datos

Con `psql` o tu cliente favorito (pgAdmin, DBeaver, etc.):

```bash
createdb migracion_prism
```

O manualmente:

```sql
CREATE DATABASE migracion_prism;
```

---

## 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y ajusta:

```
DATABASE_URL="postgresql://usuario:password@localhost:5432/migracion_prism?schema=public"
NEXTAUTH_SECRET="genera-uno-con: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
```

---

## 4. Instalar dependencias

```bash
npm install
```

---

## 5. Crear las tablas (migración de Prisma)

```bash
npx prisma migrate dev --name init
```

Esto crea todas las tablas (usuarios, tiendas, checklist, incidencias, auditoría)
en tu base `migracion_prism`.

---

## 6. Cargar los datos iniciales (seed)

```bash
npx prisma db seed
```

Esto carga automáticamente:

- El catálogo de checklist (Preparación, Actualización de equipos, Prueba de
  transacción, Validación final) con sus ítems.
- Un usuario administrador por defecto:
  - **Usuario:** `admin`
  - **Contraseña:** `Admin123!`
  - ⚠️ Cámbiala apenas ingreses (créate un nuevo admin desde `/dashboard/equipo`
    y desactiva este, o pide que se agregue un endpoint de cambio de contraseña
    antes de pasar a producción).
- Las **52 tiendas reales** extraídas de `plan_de_migracion.xlsx`, cada una con
  su checklist en estado pendiente.

---

## 7. Levantar la aplicación

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) → te redirige a `/login`.

Ingresa con `admin` / `Admin123!`.

---

## 8. Primeros pasos dentro de la app

1. Ve a **Equipo** (menú superior) y da de alta a tus técnicos, auditores TI
   y auditores de inventario reales — cada uno con su propio usuario y
   contraseña.
2. Entra a cada tienda desde el **Dashboard** y asigna el técnico/auditor
   correspondiente.
3. El equipo en campo usa su propio usuario para entrar y marcar el checklist
   de su tienda el día de la migración.
4. Cualquier falla se registra como **incidencia** directamente desde la
   ficha de la tienda.

---

## Notas importantes / próximos pasos técnicos

Este proyecto es la base funcional real (con Postgres y autenticación) que
sigue al prototipo de validación. Antes de considerarlo listo para producción,
ten en cuenta lo que ya se conversó como arquitecto del proyecto:

- **Cajas por tienda variables:** el catálogo de checklist seedeado asume
  servidor + 2 cajas para todas las tiendas. Si el número real de cajas varía,
  hay que extender `ChecklistItemDef` para permitir ítems específicos por
  tienda (o generar los ítems de "Caja N" dinámicamente al seedear, según un
  campo `numCajas` por tienda).
- **Zonas horarias:** los horarios se guardan como texto + minutos del día,
  sin huso horario explícito. Si vas a comparar "hora actual" contra la
  ventana de la tienda de forma confiable entre países, agrega una columna de
  zona horaria (IANA, ej. `America/Panama`) a `Store`.
- **Modo offline:** si los técnicos actualizarán desde la tienda con conexión
  inestable, esta primera versión requiere internet activo (llama a la API en
  cada click). Para offline-first habría que agregar Service Worker + cola de
  sincronización, similar a lo que ya implementaste en el módulo de auditorías
  de Orbis Retail.
- **Contraseñas:** cambia la contraseña del admin por defecto y define una
  política de expiración/complejidad antes de repartir usuarios al equipo.
- **HTTPS:** en producción, sirve la app detrás de HTTPS y ajusta
  `NEXTAUTH_URL` al dominio real.
- **Integración con Orbis Retail:** si decides que este módulo viva dentro de
  Orbis Retail en vez de como app independiente, este mismo schema de Prisma
  se puede fusionar al schema existente (mismo `DATABASE_URL`, mismo
  `NextAuth`), evitando duplicar autenticación e infraestructura.

---

## Estructura del proyecto

```
migracion-prism-app/
├── prisma/
│   ├── schema.prisma       # Modelo de datos completo
│   └── seed.ts             # Carga catálogo + admin + 52 tiendas reales
├── src/
│   ├── app/
│   │   ├── login/          # Página de login
│   │   ├── dashboard/      # Dashboard, ficha de tienda, equipo
│   │   └── api/            # Rutas API (stores, checklist, incidents, users, auth)
│   ├── components/         # Nav, Providers
│   ├── lib/                # prisma.ts, auth.ts
│   └── middleware.ts       # Protección de /dashboard
├── .env.example
└── package.json
```
