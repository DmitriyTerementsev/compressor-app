# Tiny WebP Compressor

Веб-приложение для пакетной оптимизации изображений через TinyPNG:

1. загрузка PNG/JPEG/WebP/AVIF;
2. сжатие исходного файла;
3. конвертация результата в WebP;
4. повторное сжатие сконвертированного WebP;
5. скачивание финального `.webp`.

UI рассчитан в первую очередь на desktop: drag-and-drop зона, очередь файлов, статусы обработки, размер до/после и процент экономии.

## Технологии

- Astro в server mode;
- Preact для интерактивного UI;
- SCSS modules;
- TinyPNG/Tinify HTTP API;
- Vercel Serverless adapter.

## Почему нужен сервер

TinyPNG API key должен оставаться секретным. Поэтому фронтенд отправляет файлы в локальный Astro API route, а уже серверный endpoint обращается к TinyPNG.

GitHub Pages для этого проекта не подходит: это статический хостинг, он не может безопасно хранить `TINIFY_API_KEY` и выполнять server-side API route. Для публичного адреса используйте Vercel, подключенный к GitHub репозиторию.

## Расход лимита TinyPNG

Текущий pipeline обычно использует 3 операции TinyPNG на один файл:

- compress исходного изображения;
- convert в `image/webp`;
- compress полученного WebP.

При бесплатном лимите 500 операций в месяц это примерно до 166 файлов в месяц для текущей трехшаговой логики.

## Локальный запуск

```bash
yarn install
cp .env.example .env
yarn dev
```

В `.env` нужно указать:

```bash
TINIFY_API_KEY=your_tinypng_api_key_here
```

## Проверка

```bash
yarn check
yarn build
```

## Деплой и публичный адрес

1. Залейте проект в GitHub repository.
2. Откройте Vercel и импортируйте этот GitHub repository.
3. В настройках Vercel project добавьте Environment Variable:

```bash
TINIFY_API_KEY=your_tinypng_api_key_here
```

4. Deploy command: `yarn build`.
5. После деплоя Vercel выдаст публичный адрес вида:

```text
https://app-img-compress-convert.vercel.app
```

При необходимости в Vercel можно подключить свой домен.

## Деплой через GitHub Actions

В репозитории есть workflow `.github/workflows/deploy.yml`. Он запускается при push в `main` и вручную через `Actions -> Deploy to Vercel -> Run workflow`.

Перед запуском нужно один раз создать проект в Vercel и добавить секреты в GitHub repository:

`Settings -> Secrets and variables -> Actions -> New repository secret`

Обязательные GitHub Secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Где взять значения:

- `VERCEL_TOKEN`: Vercel -> Account Settings -> Tokens -> Create Token.
- `VERCEL_ORG_ID` и `VERCEL_PROJECT_ID`: после локальной привязки проекта командой `vercel link` они лежат в `.vercel/project.json`. Этот файл не нужно коммитить.

TinyPNG ключ лучше хранить в Vercel project settings:

`Vercel Project -> Settings -> Environment Variables`

```text
TINIFY_API_KEY=your_tinypng_api_key_here
```

После успешного workflow Vercel выдаст production URL в логах шага `Deploy`.

## Безопасность

Файл `.env` находится в `.gitignore` и не должен попадать в репозиторий. Для GitHub и Vercel используйте только `.env.example` как шаблон.
