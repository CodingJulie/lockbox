# Операционная безопасность / Operations

Чеклист для production. Код закрывает то, что можно закрепить в репозитории; остальное — настройки кабинета.

## 4.1 Инфраструктура

| Мера                     | Статус                 | Как                                                                                                                                                                                                                                        |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase в EU            | Требование к проекту   | Создавать проект в **Frankfurt (eu-central-1)** или **Ireland (eu-west-1)**. Регион существующего проекта в кабинете не меняется — только новый проект + миграции.                                                                         |
| Vercel compute в EU      | В коде                 | `vercel.json` `regions`: `fra1`, `cdg1`; `preferredRegion` в `app/layout.tsx`.                                                                                                                                                             |
| Vercel log scrubbing     | В коде + кабинет       | API логирует только `error.message` через `lib/safe-log.ts` (Authorization/Bearer вырезаются). Env (`VAULT_HASH_PEPPER`, `AUDIT_IP_SALT`, Supabase, Upstash) пометить **Sensitive**. Не включать Log Drain, который пишет сырые заголовки. |
| WAF / боты               | Vercel Pro, кабинет    | Firewall → включить **Bot Protection**. Attack Challenge Mode — только при инциденте. Правила ниже — через CLI, не через `routes` в `vercel.json` (ломает маршрутизацию Next.js).                                                          |
| Backup encrypted at rest | Приложение + платформа | Клиент уже шифрует содержимое; бэкапы БД/Storage — ciphertext. На Pro включить PITR. Платформенное «encryption at rest» у Supabase включено по умолчанию; отдельного «encrypt my backups with our key» в SQL нет.                          |
| ipapi.co                 | Убрано                 | `/api/geo` читает только `x-vercel-ip-country` / `cf-ipcountry`. IP никуда не уходит. Без заголовка — язык `en`.                                                                                                                           |

### WAF CLI (Pro)

```bash
vercel firewall rules add --json '{
  "name": "Challenge empty User-Agent",
  "conditionGroup": [{
    "conditions": [{ "type": "user_agent", "op": "eq", "value": "" }]
  }],
  "action": { "mitigate": { "action": "challenge" } }
}'

vercel firewall rules add --json '{
  "name": "Challenge scanner tools",
  "conditionGroup": [{
    "conditions": [{ "type": "user_agent", "op": "re", "value": "(?i)(sqlmap|nikto|nmap|masscan|dirbuster)" }]
  }],
  "action": { "mitigate": { "action": "challenge" } }
}'
```

Не челленджить поисковых роботов, если нужен SEO.

## 4.2 Supply chain

| Мера        | Статус                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ffmpeg.wasm | Self-host `/ffmpeg/` из `@ffmpeg/core@0.12.10`. SHA-256 в `lib/ffmpeg-integrity.json`, проверка при копировании (`scripts/copy-ffmpeg.mjs`) и при загрузке в браузере. CDN jsDelivr убран из CSP. |
| npm audit   | CI падает на **critical** (`--omit=dev --audit-level=critical`). High пишется отчётом: остаётся nested `postcss` у Next 15 до апгрейда на 16.                                                     |

## 4.3 UX

| Мера                        | Статус                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Экстренный выход            | Кнопка «Быстрый выход» + три Escape: RAM, clipboard, local/session storage, IndexedDB-очередь, SW/Cache, `location.replace` на BBC Weather.                   |
| Предупреждение clipboard    | В диалоге кода + toast; автоочистка буфера через 30 с.                                                                                                        |
| DevTools / screen recording | **Не детектим.** Ложные срабатывания (проверка, отладка, мобильные браузеры). `Permissions-Policy: display-capture=()` уже запрещает захват вкладки из страницы. |
| Offline queue               | При обрыве mid-upload ciphertext пишется в IndexedDB (TTL 1 ч, макс. 10 файлов), flush при `online` и входе в хранилище. Panic wipe удаляет очередь.          |

## 4.4 Integrity export

См. [CHAIN_OF_CUSTODY.md](./CHAIN_OF_CUSTODY.md): журнал, `/api/time`, ZIP + manifest + SHA-256.
