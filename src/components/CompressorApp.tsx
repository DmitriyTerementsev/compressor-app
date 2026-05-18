import { useMemo, useRef, useState } from "preact/hooks";
import styles from "./CompressorApp.module.scss";

type QueueStatus = "ready" | "processing" | "done" | "error";

type QueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  progressLabel: string;
  error?: string;
  result?: OptimizedImage;
};

type OptimizedImage = {
  fileName: string;
  mimeType: string;
  originalSize: number;
  optimizedSize: number;
  width?: string | null;
  height?: string | null;
  compressionCount?: string | null;
  data: string;
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];

export default function CompressorApp() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.files += 1;
        acc.original += item.file.size;

        if (item.result) {
          acc.optimized += item.result.optimizedSize;
          acc.completed += 1;
        }

        if (item.status === "processing") {
          acc.processing += 1;
        }

        return acc;
      },
      { files: 0, completed: 0, processing: 0, original: 0, optimized: 0 },
    );
  }, [items]);

  const savedPercent =
    totals.optimized > 0
      ? Math.max(0, Math.round((1 - totals.optimized / totals.original) * 100))
      : 0;

  const addFiles = (fileList: FileList | File[]) => {
    const nextItems = Array.from(fileList)
      .filter((file) => ACCEPTED_TYPES.includes(file.type))
      .map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        status: "ready" as const,
        progressLabel: "Готов к обработке",
      }));

    if (nextItems.length === 0) {
      return;
    }

    setItems((current) => [...nextItems, ...current]);
  };

  const processAll = async () => {
    const pendingItems = items.filter(
      (item) => item.status === "ready" || item.status === "error",
    );

    for (const item of pendingItems) {
      updateItem(item.id, {
        status: "processing",
        progressLabel: "Сжатие, WebP и финальная оптимизация",
        error: undefined,
      });

      try {
        const result = await optimizeImage(item.file);

        updateItem(item.id, {
          status: "done",
          progressLabel: "Готово",
          result,
        });
      } catch (error) {
        updateItem(item.id, {
          status: "error",
          progressLabel: "Ошибка",
          error:
            error instanceof Error
              ? error.message
              : "Не удалось обработать файл",
        });
      }
    }
  };

  const clearCompleted = () => {
    setItems((current) => current.filter((item) => item.status !== "done"));
  };

  const clearAll = () => {
    setItems([]);
  };

  const canProcess =
    totals.processing === 0 &&
    items.some((item) => item.status === "ready" || item.status === "error");

  return (
    <main className={styles.shell}>
      <section className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div>
            <p className={styles.kicker}>TinyPNG API</p>
            <h1>Tiny WebP Compressor</h1>
            <p className={styles.lead}>
              Загружайте PNG, JPEG, WebP или AVIF. Приложение сжимает оригинал,
              переводит результат в WebP и возвращает компактный файл.
            </p>
            <p className={styles.limitNote}>
              TinyPNG обычно списывает 3 операции на файл: сжатие, WebP
              конвертация и финальное сжатие.
            </p>
          </div>

          <div className={styles.statsGrid}>
            <Stat label="Файлов" value={String(totals.files)} />
            <Stat label="Готово" value={String(totals.completed)} />
            <Stat label="Исходно" value={formatBytes(totals.original)} />
            <Stat
              label="Экономия"
              value={totals.optimized ? `${savedPercent}%` : "-"}
            />
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={!canProcess}
              onClick={processAll}
            >
              Запустить обработку
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={items.length === 0 || totals.processing > 0}
              onClick={clearCompleted}
            >
              Убрать готовые
            </button>
            <button
              className={styles.ghostButton}
              type="button"
              disabled={items.length === 0 || totals.processing > 0}
              onClick={clearAll}
            >
              Очистить список
            </button>
          </div>
        </aside>

        <section className={styles.panel}>
          <div
            className={`${styles.dropzone} ${
              isDragging ? styles.dropzoneActive : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              if (event.dataTransfer) {
                addFiles(event.dataTransfer.files);
              }
            }}
          >
            <input
              ref={inputRef}
              className={styles.fileInput}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              multiple
              onChange={(event) => {
                const files = event.currentTarget.files;
                if (files) {
                  addFiles(files);
                }
                event.currentTarget.value = "";
              }}
            />
            <div>
              <h2>Перетащите изображения сюда</h2>
              <p>Можно добавить сразу несколько файлов.</p>
            </div>
            <button
              className={styles.browseButton}
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              Выбрать файлы
            </button>
          </div>

          <div className={styles.queueHeader}>
            <span>Очередь</span>
            <span>
              {totals.completed}/{totals.files}
            </span>
          </div>

          <div className={styles.queue}>
            {items.length === 0 ? (
              <div className={styles.emptyState}>
                Добавьте изображения, чтобы начать сжатие.
              </div>
            ) : (
              items.map((item) => <QueueRow key={item.id} item={item} />)
            )}
          </div>
        </section>
      </section>
    </main>
  );

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const ratio = item.result
    ? Math.max(
        0,
        Math.round((1 - item.result.optimizedSize / item.result.originalSize) * 100),
      )
    : null;

  return (
    <article className={styles.queueItem}>
      <div className={styles.fileBadge}>{extensionOf(item.file.name)}</div>
      <div className={styles.fileMeta}>
        <strong title={item.file.name}>{item.file.name}</strong>
        <span>
          {formatBytes(item.file.size)}
          {item.result ? ` -> ${formatBytes(item.result.optimizedSize)}` : ""}
        </span>
        {item.error ? <p className={styles.errorText}>{item.error}</p> : null}
      </div>
      <div className={styles.resultMeta}>
        <span className={`${styles.status} ${styles[item.status]}`}>
          {item.progressLabel}
        </span>
        {ratio !== null ? <strong>-{ratio}%</strong> : null}
      </div>
      {item.result ? (
        <button
          className={styles.downloadButton}
          type="button"
          onClick={() => {
            if (item.result) {
              downloadResult(item.result);
            }
          }}
        >
          Скачать
        </button>
      ) : null}
    </article>
  );
}

async function optimizeImage(file: File): Promise<OptimizedImage> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/optimize", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "TinyPNG вернул ошибку");
  }

  return payload as OptimizedImage;
}

function downloadResult(result: OptimizedImage) {
  const byteCharacters = atob(result.data);
  const bytes = new Uint8Array(byteCharacters.length);

  for (let index = 0; index < byteCharacters.length; index += 1) {
    bytes[index] = byteCharacters.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = result.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${
    units[unitIndex]
  }`;
}

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.slice(0, 4).toUpperCase() ?? "IMG";
}
